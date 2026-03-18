const MODULE_ID = "handsomeshreks-exploration-initiative";
class HSExplorationConfig extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "hs-exploration-config",
      title: "HandsomeShrek's Exploration Initiative - Configuration",
      template: `modules/${MODULE_ID}/templates/config.hbs`,
      width: 500,
      height: "auto",
      closeOnSubmit: true
    });
  }

  getData() {
    console.log("HS Exploration Initiative | config getData");
    return {
      turnTime: game.settings.get(MODULE_ID, "turnTime"),
      separationDistance: game.settings.get(MODULE_ID, "separationDistance"),
      explorationMode: game.settings.get(MODULE_ID, "explorationMode"),
      disableCombatDisadvantage: game.settings.get(MODULE_ID, "disableCombatDisadvantage"),
      movementMultiplier: game.settings.get(MODULE_ID, "movementMultiplier")
    };
  }

  async _updateObject(_event, formData) {
    console.log("HS Exploration Initiative | config submit", formData);

    await game.settings.set(MODULE_ID, "turnTime", Number(formData.turnTime || 30));
    await game.settings.set(MODULE_ID, "separationDistance", Number(formData.separationDistance || 60));
    await game.settings.set(MODULE_ID, "explorationMode", String(formData.explorationMode || "initiative"));
    await game.settings.set(MODULE_ID, "disableCombatDisadvantage", !!formData.disableCombatDisadvantage);
    await game.settings.set(MODULE_ID, "movementMultiplier", Math.max(0.1, Number(formData.movementMultiplier || 1.5)));

    ui.notifications.info("HS Exploration Initiative settings saved.");
  }
}

class HSExploration {
  static getState() {
    return {
      active: game.settings.get(MODULE_ID, "explorationActive"),
      paused: game.settings.get(MODULE_ID, "explorationPaused"),
      turnOrder: game.settings.get(MODULE_ID, "turnOrder"),
      turnIndex: game.settings.get(MODULE_ID, "turnIndex"),
      activeTokenId: game.settings.get(MODULE_ID, "activeTokenId"),
      participants: game.settings.get(MODULE_ID, "explorationParticipants"),
      round: game.settings.get(MODULE_ID, "explorationRound"),
      mode: game.settings.get(MODULE_ID, "explorationMode"),
      parallelPhase: game.settings.get(MODULE_ID, "parallelPhase"),
      parallelStartPositions: game.settings.get(MODULE_ID, "parallelStartPositions") || {},
      parallelDoneTokenIds: game.settings.get(MODULE_ID, "parallelDoneTokenIds") || []
    };
  }

  static isSimultaneousMode() {
    return game.settings.get(MODULE_ID, "explorationMode") === "simultaneous";
  }

  static getParallelPhase() {
    return game.settings.get(MODULE_ID, "parallelPhase") || "player";
  }

  static getParallelStartPositions() {
    return game.settings.get(MODULE_ID, "parallelStartPositions") || {};
  }

  static getParallelDoneTokenIds() {
    return game.settings.get(MODULE_ID, "parallelDoneTokenIds") || [];
  }

  static getParallelUnlockedTokenIds() {
    return game.settings.get(MODULE_ID, "parallelUnlockedTokenIds") || [];
  }

  static isTokenUnlocked(tokenId) {
    return this.getParallelUnlockedTokenIds().includes(tokenId);
  }


  static getParallelMovedDistanceMap() {
    return game.settings.get(MODULE_ID, "parallelMovedDistance") || {};
  }

  static getParallelLastPositions() {
    return game.settings.get(MODULE_ID, "parallelLastPositions") || {};
  }

  static getTokenMovedDistance(tokenId) {
    const local = this._localMovedDistance?.[tokenId];
    if (Number.isFinite(local)) return Number(local);
    return Number(this.getParallelMovedDistanceMap()[tokenId] || 0);
  }

  static isGridTrackingEnabled() {
    const type = Number(canvas.scene?.grid?.type ?? canvas.grid?.type ?? 0);
    return !!canvas.grid && !!canvas.scene && type !== CONST.GRID_TYPES.GRIDLESS;
  }

  static getTokenGridBasePosition(tokenDoc) {
    const local = this._localLastPositions?.[tokenDoc?.id];
    if (local && Number.isFinite(local.x) && Number.isFinite(local.y)) return local;
    const last = this.getParallelLastPositions()[tokenDoc?.id];
    if (last && Number.isFinite(last.x) && Number.isFinite(last.y)) return last;
    return { x: Number(tokenDoc?.x || 0), y: Number(tokenDoc?.y || 0) };
  }

  static applyLocalCommittedMovement(tokenId, x, y, distance) {
    if (!tokenId) return;
    if (!this._localMovedDistance) this._localMovedDistance = {};
    if (!this._localLastPositions) this._localLastPositions = {};

    const currentMoved = Number(this._localMovedDistance[tokenId]);
    const fallbackMoved = Number(this.getParallelMovedDistanceMap()[tokenId] || 0);
    const baseMoved = Number.isFinite(currentMoved) ? currentMoved : fallbackMoved;

    this._localMovedDistance[tokenId] = baseMoved + Math.max(0, Number(distance || 0));
    this._localLastPositions[tokenId] = { x: Number(x || 0), y: Number(y || 0) };
  }

  static getGridSize() {
    return Number(canvas.scene?.grid?.size ?? canvas.grid?.size ?? 100);
  }

  static getGridDistanceUnit() {
    return Number(canvas.scene?.grid?.distance ?? canvas.dimensions?.distance ?? 5);
  }

  static snapPositionToGrid(x, y) {
    const size = this.getGridSize();
    if (!Number.isFinite(size) || size <= 0) return { x: Number(x || 0), y: Number(y || 0) };
    return {
      x: Math.round(Number(x || 0) / size) * size,
      y: Math.round(Number(y || 0) / size) * size
    };
  }

  static positionToGridCell(x, y) {
    const size = this.getGridSize();
    if (!Number.isFinite(size) || size <= 0) return { col: 0, row: 0 };
    return {
      col: Math.round(Number(x || 0) / size),
      row: Math.round(Number(y || 0) / size)
    };
  }

  static gridCellToPosition(cell) {
    const size = this.getGridSize();
    return {
      x: Number(cell?.col || 0) * size,
      y: Number(cell?.row || 0) * size
    };
  }

  static getTokenCellCenter(tokenDoc, cell) {
    const size = this.getGridSize();
    const w = Number(tokenDoc?.width ?? tokenDoc?.object?.document?.width ?? 1);
    const h = Number(tokenDoc?.height ?? tokenDoc?.object?.document?.height ?? 1);
    const pos = this.gridCellToPosition(cell);
    return {
      x: pos.x + (w * size) / 2,
      y: pos.y + (h * size) / 2
    };
  }

  static getGridPathCells(fromCell, toCell) {
    const path = [{ col: Number(fromCell.col), row: Number(fromCell.row) }];
    let col = Number(fromCell.col);
    let row = Number(fromCell.row);
    const targetCol = Number(toCell.col);
    const targetRow = Number(toCell.row);

    while (col !== targetCol || row !== targetRow) {
      if (col !== targetCol) col += Math.sign(targetCol - col);
      if (row !== targetRow) row += Math.sign(targetRow - row);
      path.push({ col, row });
    }

    return path;
  }

  static measureGridStep(tokenDoc, fromCell, toCell) {
    const startCenter = this.getTokenCellCenter(tokenDoc, fromCell);
    const endCenter = this.getTokenCellCenter(tokenDoc, toCell);
    const ray = new Ray(startCenter, endCenter);
    const measured = canvas.grid?.measureDistances?.([{ ray }], { gridSpaces: true })?.[0];
    if (Number.isFinite(measured)) return measured;

    const dx = endCenter.x - startCenter.x;
    const dy = endCenter.y - startCenter.y;
    const size = this.getGridSize();
    const unit = this.getGridDistanceUnit();
    if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(unit) || unit <= 0) return 0;
    return (Math.hypot(dx, dy) / size) * unit;
  }

  static computeGridPathDistance(tokenDoc, fromX, fromY, toX, toY) {
    if (!this.isGridTrackingEnabled()) {
      return this.measureDistanceBetween(tokenDoc, fromX, fromY, toX, toY);
    }

    const startCell = this.positionToGridCell(fromX, fromY);
    const endCell = this.positionToGridCell(toX, toY);
    const path = this.getGridPathCells(startCell, endCell);

    let total = 0;
    for (let i = 1; i < path.length; i += 1) {
      total += this.measureGridStep(tokenDoc, path[i - 1], path[i]);
    }
    return total;
  }

  static ensureGridDragSession(tokenDoc) {
    if (!tokenDoc?.id) return null;
    if (!this._gridDragSessions) this._gridDragSessions = {};

    const base = this.getTokenGridBasePosition(tokenDoc);
    const baseCell = this.positionToGridCell(base.x, base.y);
    const existing = this._gridDragSessions[tokenDoc.id];

    if (
      existing &&
      existing.baseX === base.x &&
      existing.baseY === base.y
    ) {
      return existing;
    }

    const session = {
      tokenId: tokenDoc.id,
      baseX: base.x,
      baseY: base.y,
      baseCell,
      pathCells: [baseCell],
      previewDistance: 0,
      legalDistance: 0,
      legalCell: baseCell,
      previewPosition: { x: base.x, y: base.y },
      legalPosition: { x: base.x, y: base.y },
      finalPosition: { x: base.x, y: base.y }
    };

    this._gridDragSessions[tokenDoc.id] = session;
    return session;
  }

  static clearGridDragSession(tokenId) {
    if (!this._gridDragSessions || !tokenId) return;
    delete this._gridDragSessions[tokenId];
  }

  static clearAllGridDragSessions() {
    this._gridDragSessions = {};
    this._pendingGridMoveCommits = {};
  }

  static updateGridDragSession(tokenLike) {
    const tokenDoc = tokenLike?.document ?? tokenLike;
    const liveX = Number(tokenLike?.x ?? tokenDoc?.object?.x ?? tokenDoc?.x ?? 0);
    const liveY = Number(tokenLike?.y ?? tokenDoc?.object?.y ?? tokenDoc?.y ?? 0);
    if (!tokenDoc?.id || !this.isGridTrackingEnabled()) return null;

    const session = this.ensureGridDragSession(tokenDoc);
    const liveCell = this.positionToGridCell(liveX, liveY);
    const pathCells = this.getGridPathCells(session.baseCell, liveCell);
    const committed = this.getTokenMovedDistance(tokenDoc.id);
    const cap = this.getTokenMoveCap(tokenDoc);

    session.pathCells = [session.baseCell];
    session.previewDistance = 0;
    session.legalDistance = 0;
    session.legalCell = session.baseCell;
    session.legalPosition = { x: session.baseX, y: session.baseY };

    for (let i = 1; i < pathCells.length; i += 1) {
      const previous = pathCells[i - 1];
      const cell = pathCells[i];
      const stepDistance = this.measureGridStep(tokenDoc, previous, cell);
      const nextDistance = session.previewDistance + stepDistance;
      session.pathCells.push(cell);
      session.previewDistance = nextDistance;
      if (committed + nextDistance <= cap + 0.0001) {
        session.legalDistance = nextDistance;
        session.legalCell = cell;
        session.legalPosition = this.gridCellToPosition(cell);
      }
    }

    session.previewPosition = this.snapPositionToGrid(liveX, liveY);
    session.finalPosition = this.gridCellToPosition(session.pathCells[session.pathCells.length - 1]);
    if (!session.legalPosition) session.legalPosition = { x: session.baseX, y: session.baseY };

    return session;
  }

  static buildGridMovePlan(tokenDoc, toX, toY) {
    const startX = Number(tokenDoc?.x ?? 0);
    const startY = Number(tokenDoc?.y ?? 0);
    const startCell = this.positionToGridCell(startX, startY);
    const endCell = this.positionToGridCell(toX, toY);
    const pathCells = this.getGridPathCells(startCell, endCell);
    const committed = this.getTokenMovedDistance(tokenDoc.id);
    const cap = this.getTokenMoveCap(tokenDoc);

    let previewDistance = 0;
    let legalDistance = 0;
    let legalCell = startCell;
    let legalPosition = { x: startX, y: startY };

    for (let i = 1; i < pathCells.length; i += 1) {
      const previous = pathCells[i - 1];
      const cell = pathCells[i];
      const stepDistance = this.measureGridStep(tokenDoc, previous, cell);
      const nextDistance = previewDistance + stepDistance;
      previewDistance = nextDistance;
      if (committed + nextDistance <= cap + 0.0001) {
        legalDistance = nextDistance;
        legalCell = cell;
        legalPosition = this.gridCellToPosition(cell);
      }
    }

    return {
      startCell,
      endCell,
      pathCells,
      previewDistance,
      legalDistance,
      legalCell,
      legalPosition
    };
  }

  static queuePendingGridMoveCommit(tokenDoc, update = null) {
    if (!tokenDoc?.id) return;
    if (!this._pendingGridMoveCommits) this._pendingGridMoveCommits = {};

    const tokenId = tokenDoc.id;
    const snappedFinal = this.snapPositionToGrid(update?.x ?? tokenDoc.x, update?.y ?? tokenDoc.y);
    const plan = this.buildGridMovePlan(tokenDoc, snappedFinal.x, snappedFinal.y);

    this._pendingGridMoveCommits[tokenId] = {
      x: Number(snappedFinal.x),
      y: Number(snappedFinal.y),
      distance: Math.max(0, Number(plan.legalDistance || 0))
    };
  }

  static consumePendingGridMoveCommit(tokenDoc) {
    const pending = this._pendingGridMoveCommits?.[tokenDoc?.id];
    if (!pending) return null;
    delete this._pendingGridMoveCommits[tokenDoc.id];
    return pending;
  }

  static storeRemoteGridMoveCommit(data) {
    if (!data?.tokenId) return;
    if (!this._remoteGridMoveCommits) this._remoteGridMoveCommits = {};
    this._remoteGridMoveCommits[data.tokenId] = {
      x: Number(data.x),
      y: Number(data.y),
      distance: Math.max(0, Number(data.distance || 0)),
      ts: Date.now()
    };
  }

  static consumeRemoteGridMoveCommit(tokenDoc) {
    const pending = this._remoteGridMoveCommits?.[tokenDoc?.id];
    if (!pending) return null;
    if (Number(tokenDoc.x) !== pending.x || Number(tokenDoc.y) !== pending.y) return null;
    delete this._remoteGridMoveCommits[tokenDoc.id];
    return pending;
  }

  static async waitForRemoteGridMoveCommit(tokenDoc, timeoutMs = 150) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const pending = this.consumeRemoteGridMoveCommit(tokenDoc);
      if (pending) return pending;
      await foundry.utils.sleep(25);
    }
    return null;
  }

  static measureDistanceBetween(tokenDoc, fromX, fromY, toX, toY) {
    const gridSize = canvas.scene?.grid?.size || canvas.grid?.size || 100;
    if (!Number.isFinite(gridSize) || gridSize <= 0) return 0;

    const w = Number(tokenDoc.width ?? tokenDoc.object?.document?.width ?? 1);
    const h = Number(tokenDoc.height ?? tokenDoc.object?.document?.height ?? 1);

    const startCenter = {
      x: Number(fromX) + (w * gridSize) / 2,
      y: Number(fromY) + (h * gridSize) / 2
    };
    const endCenter = {
      x: Number(toX) + (w * gridSize) / 2,
      y: Number(toY) + (h * gridSize) / 2
    };

    const ray = new Ray(startCenter, endCenter);
    const measured = canvas.grid?.measureDistances?.([{ ray }], { gridSpaces: true })?.[0];
    if (Number.isFinite(measured)) return measured;

    const gridDistance = Number(canvas.scene?.grid?.distance ?? canvas.dimensions?.distance ?? 5);
    if (!Number.isFinite(gridDistance) || gridDistance <= 0) return 0;
    const dx = endCenter.x - startCenter.x;
    const dy = endCenter.y - startCenter.y;
    const pxDistance = Math.hypot(dx, dy);
    return (pxDistance / gridSize) * gridDistance;
  }

  static async recordTokenMovement(tokenDoc, explicitDistance = null) {
    if (!game.user.isGM) return;
    const activeGM = game.users?.activeGM;
    if (activeGM && activeGM.id !== game.user.id) return;
    if (!this.isSimultaneousMode()) return;
    if (this.getParallelPhase() !== "player") return;

    const isPlayerToken = !!(tokenDoc?.actor?.hasPlayerOwner ?? tokenDoc?.object?.actor?.hasPlayerOwner);
    if (!isPlayerToken) return;

    const tokenId = tokenDoc.id;
    const movedMap = foundry.utils.deepClone(this.getParallelMovedDistanceMap());
    const lastMap = foundry.utils.deepClone(this.getParallelLastPositions());

    const prev = lastMap[tokenId];
    const now = { x: Number(tokenDoc.x), y: Number(tokenDoc.y) };

    if (Number.isFinite(explicitDistance)) {
      movedMap[tokenId] = Number(movedMap[tokenId] || 0) + Math.max(0, Number(explicitDistance));
    } else if (prev && Number.isFinite(prev.x) && Number.isFinite(prev.y)) {
      const delta = this.computeGridPathDistance(tokenDoc, prev.x, prev.y, now.x, now.y);
      movedMap[tokenId] = Number(movedMap[tokenId] || 0) + Math.max(0, delta);
    } else {
      movedMap[tokenId] = Number(movedMap[tokenId] || 0);
    }

    lastMap[tokenId] = now;
    await game.settings.set(MODULE_ID, "parallelMovedDistance", movedMap);
    await game.settings.set(MODULE_ID, "parallelLastPositions", lastMap);

    this._localMovedDistance = foundry.utils.deepClone(movedMap);
    this._localLastPositions = foundry.utils.deepClone(lastMap);
  }
  static isTokenDone(tokenId) {
    return this.getParallelDoneTokenIds().includes(tokenId);
  }

  static getTokenBaseSpeed(tokenDoc) {
    const actor = tokenDoc?.actor ?? tokenDoc?.object?.actor;
    const movement = actor?.system?.attributes?.movement;

    const values = [
      movement?.walk,
      movement?.land,
      movement?.burrow,
      movement?.fly,
      movement?.climb,
      movement?.swim,
      movement,
      actor?.system?.attributes?.speed?.value
    ];

    for (const v of values) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) return n;
    }

    return 30;
  }

  static getTokenMoveCap(tokenDoc) {
    const mult = Math.max(0.1, Number(game.settings.get(MODULE_ID, "movementMultiplier") || 1.5));
    return this.getTokenBaseSpeed(tokenDoc) * mult;
  }

  static getTokenRemainingMovement(tokenDoc) {
    const cap = this.getTokenMoveCap(tokenDoc);
    const used = this.getTokenMovedDistance(tokenDoc.id);
    return Math.max(0, cap - used);
  }

  static async initializeParallelPlayerPhase({ incrementRound = false } = {}) {
    if (!game.user.isGM) return;

    const tokens = this.getEligibleTokens();
    const starts = {};
    for (const t of tokens) starts[t.id] = { x: t.document.x, y: t.document.y };

    if (incrementRound) {
      const round = Number(game.settings.get(MODULE_ID, "explorationRound") || 1) + 1;
      await game.settings.set(MODULE_ID, "explorationRound", round);
    }

    const moved = {};
    for (const t of tokens) moved[t.id] = 0;

    await game.settings.set(MODULE_ID, "parallelPhase", "player");
    await game.settings.set(MODULE_ID, "parallelStartPositions", starts);
    await game.settings.set(MODULE_ID, "parallelDoneTokenIds", []);
    await game.settings.set(MODULE_ID, "parallelUnlockedTokenIds", []);
    await game.settings.set(MODULE_ID, "parallelMovedDistance", moved);
    await game.settings.set(MODULE_ID, "parallelLastPositions", starts);

    this._localMovedDistance = foundry.utils.deepClone(moved);
    this._localLastPositions = foundry.utils.deepClone(starts);
    this.clearAllGridDragSessions();
    await this.clearTurnTimer();
  }

  static async startParallelExploration() {
    if (!game.user.isGM) return;

    let participants = game.settings.get(MODULE_ID, "explorationParticipants");
    if (!participants?.length) participants = await this.syncParticipantsFromScene();

    await game.settings.set(MODULE_ID, "explorationParticipants", participants || []);
    await game.settings.set(MODULE_ID, "explorationActive", true);
    await game.settings.set(MODULE_ID, "explorationPaused", false);
    await game.settings.set(MODULE_ID, "turnOrder", []);
    await game.settings.set(MODULE_ID, "turnIndex", 0);
    await game.settings.set(MODULE_ID, "activeTokenId", "");
    await game.settings.set(MODULE_ID, "explorationRound", 1);
    await this.initializeParallelPlayerPhase({ incrementRound: false });

    ui.notifications.info("Simultaneous player phase started.");
    ui.combat?.render(true);
  }

  static async startNextParallelPlayerPhase() {
    if (!game.user.isGM) return;
    await this.initializeParallelPlayerPhase({ incrementRound: true });
    ui.notifications.info("New player phase started.");
    ui.combat?.render(true);
  }

  static async endEnvironmentTurn() {
    if (!game.user.isGM) return;
    if (!this.isSimultaneousMode()) return;
    if (this.getParallelPhase() !== "environment") return;
    await this.startNextParallelPlayerPhase();
  }

  static async setParallelEnvironmentPhase() {
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, "parallelPhase", "environment");
    await this.clearTurnTimer();
    ui.notifications.info("Environment phase started.");
    ui.combat?.render(true);
  }

  static canCurrentUserMarkDoneSelectedToken() {
    if (!this.isSimultaneousMode()) return false;
    const state = this.getState();
    if (!state.active || state.paused) return false;
    if (this.getParallelPhase() !== "player") return false;

    const selected = canvas.tokens?.controlled || [];
    if (!selected.length) return false;

    return selected.some((token) => (
      this.canUserControlToken(game.user.id, token.id) && !this.isTokenDone(token.id)
    ));
  }

  static async requestMarkDoneSelectedToken() {
    if (!this.isSimultaneousMode()) return;

    const tokenIds = (canvas.tokens?.controlled || [])
      .map((token) => token.id)
      .filter((tokenId) => this.canUserControlToken(game.user.id, tokenId) && !this.isTokenDone(tokenId));

    if (!tokenIds.length) return;

    if (game.user.isGM) {
      for (const tokenId of tokenIds) {
        await this.markTokenDone(tokenId, game.user.id);
      }
      return;
    }

    game.socket?.emit(`module.${MODULE_ID}`, {
      type: "hs-mark-token-done",
      userId: game.user.id,
      tokenIds
    });
  }

  static async markTokenDone(tokenId, userId) {
    if (!game.user.isGM) return;
    const state = this.getState();
    if (!state.active || state.paused) return;
    if (this.getParallelPhase() !== "player") return;
    if (!this.canUserControlToken(userId, tokenId)) return;

    const done = this.getParallelDoneTokenIds();
    if (!done.includes(tokenId)) {
      done.push(tokenId);
      await game.settings.set(MODULE_ID, "parallelDoneTokenIds", done);
    }

    await this.evaluateParallelPhaseCompletion();
    ui.combat?.render(true);
  }

  static async toggleSelectedTokenMovementLock() {
    if (!game.user.isGM) return;
    if (!this.isSimultaneousMode()) return;

    const selected = canvas.tokens?.controlled || [];
    if (!selected.length) {
      ui.notifications.warn("Select one or more tokens to toggle movement lock.");
      return;
    }

    const unlocked = new Set(this.getParallelUnlockedTokenIds());
    const allSelectedUnlocked = selected.every((t) => unlocked.has(t.id));

    for (const t of selected) {
      if (allSelectedUnlocked) unlocked.delete(t.id);
      else unlocked.add(t.id);
      this.clearGridDragSession(t.id);
    }

    await game.settings.set(MODULE_ID, "parallelUnlockedTokenIds", Array.from(unlocked));

    ui.notifications.info(allSelectedUnlocked
      ? `Locked movement for ${selected.length} selected token(s).`
      : `Unlocked movement for ${selected.length} selected token(s).`);
    HSExploration.updateMovementHud();
    ui.combat?.render(true);
  }

  static async toggleAllTokenMovementLock() {
    if (!game.user.isGM) return;
    if (!this.isSimultaneousMode()) return;

    const tokens = this.getEligibleTokens();
    const unlocked = new Set(this.getParallelUnlockedTokenIds());
    const allUnlocked = tokens.length && tokens.every((t) => unlocked.has(t.id));

    for (const t of tokens) {
      if (allUnlocked) unlocked.delete(t.id);
      else unlocked.add(t.id);
      this.clearGridDragSession(t.id);
    }

    await game.settings.set(MODULE_ID, "parallelUnlockedTokenIds", Array.from(unlocked));

    ui.notifications.info(allUnlocked
      ? "Locked movement for all participants."
      : "Unlocked movement for all participants.");
    ui.combat?.render(true);
  }

  static async resetSelectedTokenMovement() {
    if (!game.user.isGM) return;
    if (!this.isSimultaneousMode()) return;

    const selected = canvas.tokens?.controlled || [];
    if (!selected.length) {
      ui.notifications.warn("Select one or more tokens to reset movement.");
      return;
    }

    const moved = foundry.utils.deepClone(this.getParallelMovedDistanceMap());
    const last = foundry.utils.deepClone(this.getParallelLastPositions());

    for (const token of selected) {
      moved[token.id] = 0;
      last[token.id] = { x: Number(token.document.x), y: Number(token.document.y) };
      this.clearGridDragSession(token.id);
    }

    await game.settings.set(MODULE_ID, "parallelMovedDistance", moved);
    await game.settings.set(MODULE_ID, "parallelLastPositions", last);

    this._localMovedDistance = foundry.utils.deepClone(moved);
    this._localLastPositions = foundry.utils.deepClone(last);

    ui.notifications.info(`Reset movement for ${selected.length} selected token(s).`);
    this.updateMovementHud();
    ui.combat?.render(true);
  }

  static async evaluateParallelPhaseCompletion() {
    if (!game.user.isGM) return;
    if (!this.isSimultaneousMode()) return;

    const state = this.getState();
    if (!state.active || state.paused) return;
    if (this.getParallelPhase() !== "player") return;

    const tokens = this.getEligibleTokens();
    if (!tokens.length) return;

    const doneIds = this.getParallelDoneTokenIds();
    const allDone = tokens.every(t => doneIds.includes(t.id));

    if (allDone) await this.setParallelEnvironmentPhase();
  }

  static getTurnDurationMs() {
    const seconds = Number(game.settings.get(MODULE_ID, "turnTime")) || 30;
    return Math.max(1, seconds) * 1000;
  }

  static getTurnEndsAt() {
    return Number(game.settings.get(MODULE_ID, "turnEndsAt") || 0);
  }

  static getRemainingTurnSeconds() {
    const state = this.getState();
    if (!state.active || state.paused) return null;

    const turnEndsAt = this.getTurnEndsAt();
    if (!turnEndsAt) return null;

    return Math.max(0, Math.ceil((turnEndsAt - Date.now()) / 1000));
  }

  static formatTurnSeconds(totalSeconds) {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  static getTurnTimerDisplay() {
    const remaining = this.getRemainingTurnSeconds();
    if (remaining === null) return "--:--";
    return this.formatTurnSeconds(remaining);
  }

  static async restartTurnTimer() {
    const turnEndsAt = Date.now() + this.getTurnDurationMs();
    await game.settings.set(MODULE_ID, "turnEndsAt", turnEndsAt);
  }

  static async clearTurnTimer() {
    await game.settings.set(MODULE_ID, "turnEndsAt", 0);
  }

  static attachTurnTimerTicker(container) {
    if (this._turnTimerTicker) {
      clearInterval(this._turnTimerTicker);
      this._turnTimerTicker = null;
    }

    const updateTimer = () => {
      const timerEl = container.querySelector("[data-hs-turn-timer]");
      if (!timerEl) return;

      if (this.isSimultaneousMode()) {
        timerEl.textContent = this.getParallelPhase() === "player" ? "PLAYER PHASE" : "ENVIRONMENT PHASE";
        timerEl.classList.remove("expired");

        const doneBtn = container.querySelector("[data-action='hs-done-selected']");
        if (doneBtn) {
          const canDone = this.canCurrentUserMarkDoneSelectedToken();
          doneBtn.disabled = !canDone;
          doneBtn.classList.toggle("disabled", !canDone);
        }

        void this.handleTurnTimerExpiry();
        return;
      }

      const remaining = this.getRemainingTurnSeconds();
      timerEl.textContent = remaining === null ? "--:--" : this.formatTurnSeconds(remaining);
      timerEl.classList.toggle("expired", remaining === 0);

      const startBtn = container.querySelector("[data-action='hs-start-turn-timer']");
      if (startBtn) {
        const canStart = this.canCurrentUserStartTurnTimer();
        startBtn.disabled = !canStart;
        startBtn.classList.toggle("disabled", !canStart);
      }

      void this.handleTurnTimerExpiry();
    };

    updateTimer();
    this._turnTimerTicker = setInterval(updateTimer, 250);
  }


  static refreshRemainingMovementDisplay(container) {
    if (!this.isSimultaneousMode()) return;

    container.querySelectorAll("[data-hs-remaining]").forEach((el) => {
      const tokenId = el.dataset.hsRemaining;
      if (!tokenId) return;

      const token = canvas.tokens?.get(tokenId);
      if (!token) {
        el.textContent = "-";
        return;
      }

      const remaining = this.getTokenRemainingMovement(token.document);
      el.textContent = `${remaining.toFixed(1)} ft`;
    });
  }

  static ensureMovementHud() {
    let hud = document.getElementById("hs-live-move-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "hs-live-move-hud";
      hud.className = "hs-live-move-hud";
      document.body.appendChild(hud);
    }

    if (!hud.dataset.initialized) {
      hud.innerHTML = `
        <div class="hs-live-move-info">
          <div class="hs-live-move-title" data-hs-hud-title></div>
          <div class="hs-live-move-value" data-hs-hud-value></div>
          <div class="hs-live-move-sub" data-hs-hud-sub></div>
        </div>
        <button type="button" data-action="hs-hud-done" class="hs-live-move-done">Finish Turn</button>
      `;
      hud.dataset.initialized = "1";
    }

    if (!hud.dataset.bound) {
      const triggerDone = async (event) => {
        const target = event.target?.closest?.("[data-action='hs-hud-done']");
        if (!target) return;
        event.preventDefault();
        event.stopPropagation();
        await HSExploration.requestMarkDoneSelectedToken();
        HSExploration.updateMovementHud();
      };

      hud.addEventListener("pointerdown", triggerDone);
      hud.addEventListener("click", triggerDone);
      hud.dataset.bound = "1";
    }

    return hud;
  }

  static updateMovementHud() {
    const hud = this.ensureMovementHud();
    const state = this.getState();

    if (!this.isSimultaneousMode() || !state.active || state.paused || this.getParallelPhase() !== "player") {
      hud.style.display = "none";
      return;
    }

    const selected = canvas.tokens?.controlled?.[0];
    if (!selected || !this.canUserControlToken(game.user.id, selected.id)) {
      hud.style.display = "none";
      return;
    }

    const cap = this.getTokenMoveCap(selected.document);
    const remaining = this.getTokenRemainingMovement(selected.document);
    const used = Math.max(0, cap - remaining);
    const canDone = this.canCurrentUserMarkDoneSelectedToken();

    hud.style.display = "flex";
    const title = hud.querySelector("[data-hs-hud-title]");
    const value = hud.querySelector("[data-hs-hud-value]");
    const sub = hud.querySelector("[data-hs-hud-sub]");
    const button = hud.querySelector("[data-action='hs-hud-done']");

    if (title) title.textContent = selected.name;
    if (value) value.textContent = `${remaining.toFixed(1)} ft left`;
    if (sub) sub.textContent = `${used.toFixed(1)} / ${cap.toFixed(1)} ft used`;
    if (button) {
      button.disabled = !canDone;
      button.textContent = "Finish Turn";
    }

  }

  static attachSimultaneousMovementTicker(container) {
    if (this._simMovementTicker) {
      clearInterval(this._simMovementTicker);
      this._simMovementTicker = null;
    }

    const updateControls = () => {
      const controlled = canvas.tokens?.controlled || [];
      for (const token of controlled) {
        const preview = canvas.tokens?.preview?.children?.find?.((child) => child?.document?.id === token.id);
        this.updateGridDragSession(preview || token);
      }
      this.refreshRemainingMovementDisplay(container);
      this.updateMovementHud();
      const doneBtn = container.querySelector("[data-action='hs-done-selected']");
      const unlockSelectedBtn = container.querySelector("[data-action='hs-unlock-selected']");
      const unlockAllBtn = container.querySelector("[data-action='hs-unlock-all']");
      if (doneBtn) {
        const canDone = this.canCurrentUserMarkDoneSelectedToken();
        doneBtn.disabled = !canDone;
        doneBtn.classList.toggle("disabled", !canDone);
      }
      if (unlockSelectedBtn && game.user.isGM) {
        const selected = canvas.tokens?.controlled || [];
        const allSelectedUnlocked = !!selected.length && selected.every((t) => this.isTokenUnlocked(t.id));
        unlockSelectedBtn.textContent = allSelectedUnlocked ? "Lock Selected" : "Unlock Selected";
      }
      if (unlockAllBtn && game.user.isGM) {
        const tokens = this.getEligibleTokens();
        const allUnlocked = !!tokens.length && tokens.every((t) => this.isTokenUnlocked(t.id));
        unlockAllBtn.textContent = allUnlocked ? "Lock All" : "Unlock All";
      }
    };

    updateControls();
    this._simMovementTicker = setInterval(updateControls, 60);
  }
  static clearUiTickers() {
    if (this._turnTimerTicker) {
      clearInterval(this._turnTimerTicker);
      this._turnTimerTicker = null;
    }

    if (this._simMovementTicker) {
      clearInterval(this._simMovementTicker);
      this._simMovementTicker = null;
    }

    const hud = document.getElementById("hs-live-move-hud");
    if (hud) hud.style.display = "none";
  }

  static async setTrackerTab(tabName) {
  await game.settings.set(MODULE_ID, "trackerTab", tabName);
  ui.combat?.render(true);
}
  static getEligibleTokens() {
    return (canvas.tokens?.placeables ?? []).filter(t => t.actor?.hasPlayerOwner);
  }

  static async syncParticipantsFromScene() {
    if (!game.user.isGM) return;
    const tokens = this.getEligibleTokens();

    const participants = tokens.map(t => ({
      tokenId: t.id,
      actorId: t.actor?.id ?? "",
      name: t.name,
      initiative: null
    }));

    await game.settings.set(MODULE_ID, "explorationParticipants", participants);
    return participants;
  }

  static async startExploration() {
    if (!game.user.isGM) return;

    if (this.isSimultaneousMode()) {
      await this.startParallelExploration();
      return;
    }
    let participants = game.settings.get(MODULE_ID, "explorationParticipants");

    if (!participants?.length) {
      participants = await this.syncParticipantsFromScene();
    }

    const sorted = participants.slice().sort((a, b) => {

      const aInit = Number.isFinite(a.initiative) ? a.initiative : -Infinity;
      const bInit = Number.isFinite(b.initiative) ? b.initiative : -Infinity;
      if (aInit !== bInit) return bInit - aInit;

      return (a.name || "").localeCompare(b.name || "");
    });

    const order = sorted.map(p => p.tokenId);

    await game.settings.set(MODULE_ID, "explorationParticipants", sorted);
    await game.settings.set(MODULE_ID, "turnOrder", order);
    await game.settings.set(MODULE_ID, "turnIndex", 0);
    await game.settings.set(MODULE_ID, "activeTokenId", order[0] ?? "");
    await game.settings.set(MODULE_ID, "explorationRound", 1);
    await game.settings.set(MODULE_ID, "explorationActive", true);
    await game.settings.set(MODULE_ID, "explorationPaused", false);
    await this.restartTurnTimer();

    ui.notifications.info("Exploration started.");
    ui.combat?.render(true);
  }

  static async advanceTurn({ startTimer = true } = {}) {
    if (!game.user.isGM) return;

    const state = this.getState();
    if (!state.turnOrder.length) return;

    let nextIndex = state.turnIndex + 1;
    let round = state.round;

    if (nextIndex >= state.turnOrder.length) {
      nextIndex = 0;
      round += 1;
    }

    await game.settings.set(MODULE_ID, "turnIndex", nextIndex);
    await game.settings.set(MODULE_ID, "activeTokenId", state.turnOrder[nextIndex] ?? "");
    await game.settings.set(MODULE_ID, "explorationRound", round);

    if (startTimer) await this.restartTurnTimer();
    else await this.clearTurnTimer();

    ui.combat?.render(true);
  }

  static async nextTurn() {
    await this.advanceTurn({ startTimer: true });
  }

  static async pauseExploration() {
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, "explorationPaused", true);
    await this.clearTurnTimer();
    ui.combat?.render(true);
  }

  static async resumeExploration() {
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, "explorationPaused", false);
    await this.restartTurnTimer();
    ui.combat?.render(true);
  }

  static async endExploration() {
    if (!game.user.isGM) return;
    await game.settings.set(MODULE_ID, "explorationActive", false);
    await game.settings.set(MODULE_ID, "explorationPaused", false);
    await game.settings.set(MODULE_ID, "turnOrder", []);
    await game.settings.set(MODULE_ID, "turnIndex", 0);
    await game.settings.set(MODULE_ID, "activeTokenId", "");
    await game.settings.set(MODULE_ID, "explorationRound", 1);
    await this.clearTurnTimer();
    await game.settings.set(MODULE_ID, "parallelUnlockedTokenIds", []);
    this.clearAllGridDragSessions();
    this._localMovedDistance = {};
    this._localLastPositions = {};
    ui.combat?.render(true);
  }

  static async pauseExplorationForCombatStart() {
    if (!game.user.isGM) return;

    const activeGM = game.users?.activeGM;
    if (activeGM && activeGM.id !== game.user.id) return;

    const active = game.settings.get(MODULE_ID, "explorationActive");
    const paused = game.settings.get(MODULE_ID, "explorationPaused");
    if (!active || paused) return;

    await game.settings.set(MODULE_ID, "explorationPaused", true);
    await HSExploration.clearTurnTimer();
    ui.notifications.info("Exploration paused due to combat.");
    ui.combat?.render(true);
  }

  static async focusParticipantToken(tokenId, { additive = false } = {}) {
    if (!tokenId) return;
    const token = canvas.tokens?.get(tokenId);
    if (!token) return;

    const canFocus = game.user.isGM || this.canUserControlToken(game.user.id, tokenId);
    if (!canFocus) return;

    token.control({ releaseOthers: !additive });
    this.updateMovementHud();
  }

  static async selectAllParticipantTokens() {
    const tokens = this.getEligibleTokens().filter((token) => (
      game.user.isGM || this.canUserControlToken(game.user.id, token.id)
    ));

    if (!tokens.length) return;

    const [first, ...rest] = tokens;
    first.control({ releaseOthers: true });
    for (const token of rest) token.control({ releaseOthers: false });
    this.updateMovementHud();
  }

  static async clearSelectedTokens() {
    canvas.tokens?.releaseAll();
    this.updateMovementHud();
  }

  static canUserControlToken(userId, tokenId) {
    const user = game.users?.get(userId);
    if (!user || !tokenId) return false;
    if (user.isGM) return true;

    const token = canvas.tokens?.get(tokenId);
    const actor = token?.actor ?? canvas.scene?.tokens?.get(tokenId)?.actor;
    if (!actor?.testUserPermission) return false;

    return actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  }

  static canCurrentUserStartTurnTimer() {
    const state = this.getState();
    if (!state.active || state.paused) return false;
    if (!state.activeTokenId) return false;

    const remaining = this.getRemainingTurnSeconds();
    if (remaining !== null && remaining > 0) return false;

    return this.canUserControlToken(game.user.id, state.activeTokenId);
  }

  static async requestStartTurnTimer() {
    if (!this.canCurrentUserStartTurnTimer()) return;

    const state = this.getState();
    if (game.user.isGM) {
      await this.restartTurnTimer();
      ui.combat?.render(true);
      return;
    }

    game.socket?.emit(`module.${MODULE_ID}`, {
      type: "hs-start-turn-timer",
      userId: game.user.id,
      tokenId: state.activeTokenId
    });
  }

  static async requestRollParticipantInitiative(tokenId) {
    if (!tokenId) return;

    if (!this.canUserControlToken(game.user.id, tokenId)) return;

    if (game.user.isGM) {
      await this.rollParticipantInitiative(tokenId);
      return;
    }

    game.socket?.emit(`module.${MODULE_ID}`, {
      type: "hs-roll-participant-initiative",
      userId: game.user.id,
      tokenId
    });
  }

  static async onSocketMessage(data) {
    if (!game.user.isGM) return;

    const activeGM = game.users?.activeGM;
    if (activeGM && activeGM.id !== game.user.id) return;

    if (data?.type === "hs-start-turn-timer") {
      const state = this.getState();
      if (!state.active || state.paused) return;
      if (!state.activeTokenId || data.tokenId !== state.activeTokenId) return;

      const remaining = this.getRemainingTurnSeconds();
      if (remaining !== null && remaining > 0) return;

      if (!this.canUserControlToken(data.userId, state.activeTokenId)) return;

      await this.restartTurnTimer();
      ui.combat?.render(true);
      return;
    }

    if (data?.type === "hs-roll-participant-initiative") {
      if (!data.tokenId) return;
      if (!this.canUserControlToken(data.userId, data.tokenId)) return;
      await this.rollParticipantInitiative(data.tokenId);
      return;
    }

    if (data?.type === "hs-mark-token-done") {
      const tokenIds = Array.isArray(data.tokenIds)
        ? data.tokenIds
        : (data.tokenId ? [data.tokenId] : []);
      if (!tokenIds.length) return;
      for (const tokenId of tokenIds) {
        await this.markTokenDone(tokenId, data.userId);
      }
      return;
    }

    if (data?.type === "hs-record-grid-move") {
      if (!data.tokenId) return;
      if (!this.canUserControlToken(data.userId, data.tokenId)) return;
      this.storeRemoteGridMoveCommit(data);
    }
  }

  static async handleTurnTimerExpiry() {
    if (!game.user.isGM) return;

    const activeGM = game.users?.activeGM;
    if (activeGM && activeGM.id !== game.user.id) return;

    const state = this.getState();
    if (!state.active || state.paused) return;

    const turnEndsAt = this.getTurnEndsAt();
    if (!turnEndsAt || Date.now() < turnEndsAt) return;

    if (this._turnAdvancePending) return;
    this._turnAdvancePending = true;

    try {
      await this.advanceTurn({ startTimer: false });
    } finally {
      this._turnAdvancePending = false;
    }
  }

  static allowMovement(tokenDoc, update = null) {
    const state = this.getState();
    if (!state.active) return true;
    if (state.paused) return false;

    if (this.isSimultaneousMode()) {
      const isGM = game.user.isGM;
      const isPlayerToken = !!(tokenDoc?.actor?.hasPlayerOwner ?? tokenDoc?.object?.actor?.hasPlayerOwner);

      if (this.getParallelPhase() !== "player") return isGM && !isPlayerToken;
      if (!isPlayerToken) return false;
      if (!isGM && !this.canUserControlToken(game.user.id, tokenDoc.id)) return false;
      if (this.isTokenUnlocked(tokenDoc.id)) return true;
      if (this.isTokenDone(tokenDoc.id)) return false;

      const moved = this.getTokenMovedDistance(tokenDoc.id);
      const nextX = update?.x ?? tokenDoc.x;
      const nextY = update?.y ?? tokenDoc.y;
      const delta = this.buildGridMovePlan(tokenDoc, nextX, nextY).previewDistance;
      const cap = this.getTokenMoveCap(tokenDoc);
      return moved + delta <= cap + 0.0001;
    }

    if (game.user.isGM) return true;

    const remaining = this.getRemainingTurnSeconds();
    if (remaining === null || remaining <= 0) return false;

    return tokenDoc.id === state.activeTokenId;
  }

  static clampUpdateToRemainingMovement(tokenDoc, update = null) {
    const moved = this.getTokenMovedDistance(tokenDoc.id);
    const cap = this.getTokenMoveCap(tokenDoc);
    const remaining = cap - moved;

    const nextX = update?.x ?? tokenDoc.x;
    const nextY = update?.y ?? tokenDoc.y;
    const plan = this.buildGridMovePlan(tokenDoc, nextX, nextY);
    const delta = plan.previewDistance;

    // Already out of movement: keep position fixed.
    if (remaining <= 0.0001) {
      update.x = tokenDoc.x;
      update.y = tokenDoc.y;
      return true;
    }

    // If this move is within remaining allowance, no clamping needed.
    if (delta <= remaining + 0.0001) return false;

    if (plan?.legalPosition) {
      update.x = Number(plan.legalPosition.x);
      update.y = Number(plan.legalPosition.y);
      return true;
    }

    const ratio = remaining / delta;
    const clampedX = tokenDoc.x + (nextX - tokenDoc.x) * ratio;
    const clampedY = tokenDoc.y + (nextY - tokenDoc.y) * ratio;

    update.x = Math.round(clampedX);
    update.y = Math.round(clampedY);
    return true;
  }

  static async waitForDiceSoNice(messageId) {
    if (!game.modules.get("dice-so-nice")?.active) return;
    if (!messageId) return;

    await new Promise(resolve => {
      let resolved = false;
      const targetId = String(messageId);

      const onComplete = (payload) => {
        const completedId = typeof payload === "string"
          ? payload
          : payload?.id ?? payload?.messageId ?? payload?._id;

        if (!completedId) return;
        if (String(completedId) === targetId) done();
      };

      const done = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        Hooks.off("diceSoNiceRollComplete", onComplete);
        resolve();
      };

      const timeout = setTimeout(done, 12000);
      Hooks.on("diceSoNiceRollComplete", onComplete);
    });
  }

  static async rollParticipantInitiative(tokenId) {
    if (!game.user.isGM) return;
    const initialParticipants = foundry.utils.deepClone(game.settings.get(MODULE_ID, "explorationParticipants") || []);
    const initialRow = initialParticipants.find(p => p.tokenId === tokenId);
    if (!initialRow) return;

    const roll = await (new Roll("1d20")).evaluate();
    const chatMessage = await roll.toMessage({
      flavor: `Exploration Initiative: ${initialRow.name}`
    });

    await this.waitForDiceSoNice(chatMessage?.id);

    const participants = foundry.utils.deepClone(game.settings.get(MODULE_ID, "explorationParticipants") || []);
    const row = participants.find(p => p.tokenId === tokenId);
    if (!row) return;
    row.initiative = roll.total;

    const sorted = participants.slice().sort((a, b) => {
      const aInit = Number.isFinite(a.initiative) ? a.initiative : -Infinity;
      const bInit = Number.isFinite(b.initiative) ? b.initiative : -Infinity;
      if (aInit !== bInit) return bInit - aInit;

      return (a.name || "").localeCompare(b.name || "");
    });

    const order = sorted.map(p => p.tokenId);

    await game.settings.set(MODULE_ID, "explorationParticipants", sorted);
    await game.settings.set(MODULE_ID, "turnOrder", order);

    const active = game.settings.get(MODULE_ID, "explorationActive");
    const activeTokenId = game.settings.get(MODULE_ID, "activeTokenId");
    let turnIndex = game.settings.get(MODULE_ID, "turnIndex") || 0;

    if (!order.length) {
      await game.settings.set(MODULE_ID, "turnIndex", 0);
      await game.settings.set(MODULE_ID, "activeTokenId", "");
    } else if (active) {
      const existingIndex = order.indexOf(activeTokenId);
      turnIndex = existingIndex >= 0 ? existingIndex : Math.min(turnIndex, order.length - 1);
      if (turnIndex < 0) turnIndex = 0;
      await game.settings.set(MODULE_ID, "turnIndex", turnIndex);
      await game.settings.set(MODULE_ID, "activeTokenId", order[turnIndex]);
    }

    ui.combat?.render(true);
  }

  static buildExplorationMarkup() {
    const state = this.getState();
    const participants = state.participants || [];
    const activeTokenId = state.activeTokenId;
    const isSimultaneous = this.isSimultaneousMode();
    const controlledIds = new Set((canvas.tokens?.controlled || []).map((t) => t.id));

    const rows = participants.length
      ? participants.map((p, idx) => {
          const active = !isSimultaneous && p.tokenId === activeTokenId;
          const done = isSimultaneous && this.isTokenDone(p.tokenId);
          const selected = controlledIds.has(p.tokenId);
          const init = p.initiative ?? "-";
          const token = canvas.tokens?.get(p.tokenId);
          const rightMarkup = isSimultaneous
            ? `<span class="hs-exp-init" data-hs-remaining="${p.tokenId}">${token ? `${this.getTokenRemainingMovement(token.document).toFixed(1)} ft` : "-"}</span>`
            : `${Number.isFinite(p.initiative)
                ? ""
                : `<button type="button" class="hs-exp-roll" data-token-id="${p.tokenId}" title="Roll initiative"><i class="fas fa-dice-d20"></i></button>`}
               <span class="hs-exp-init">${init}</span>`;

          return `
            <li class="hs-exp-row ${active ? "active" : ""} ${selected ? "selected" : ""} ${done ? "done" : ""}" data-token-id="${p.tokenId}">
              <div class="hs-exp-left">
                <span class="hs-exp-name">${isSimultaneous ? p.name : `${idx + 1}. ${p.name}`}</span>
              </div>
              <div class="hs-exp-right">
                ${rightMarkup}
              </div>
            </li>
          `;
        }).join("")
      : `<li class="hs-exp-empty">No participants synced yet.</li>`;

    return `
      <section class="hs-exp-root">
        ${game.user.isGM ? `
        <div class="hs-exp-toolbar">
          <button type="button" data-action="hs-sync">Sync PCs</button>
          <button type="button" data-action="hs-start">Start Exploration</button>
          ${isSimultaneous ? `<button type="button" data-action="hs-select-all">Select All PCs</button>` : ""}
          ${isSimultaneous ? `<button type="button" data-action="hs-clear-selection">Clear Selection</button>` : ""}
          ${isSimultaneous ? "" : `<button type="button" data-action="hs-next">Next Turn</button>`}
          <button type="button" data-action="hs-pause">Pause</button>
          <button type="button" data-action="hs-resume">Resume Exploration</button>
          <button type="button" data-action="hs-end">End</button>
        </div>
        ` : ""}

        <div class="hs-exp-summary">
          <div><strong>Status:</strong> ${state.active ? (state.paused ? "Paused" : "Active") : "Not Started"}</div>
          <div><strong>Round:</strong> ${state.round}</div>
        </div>

        <ol class="hs-exp-list">
          ${rows}
        </ol>

        ${isSimultaneous ? `
        <div class="hs-exp-turn-controls">
          <button
            type="button"
            data-action="hs-done-selected"
            class="hs-start-turn-timer hs-exp-turn-primary ${this.canCurrentUserMarkDoneSelectedToken() ? "" : "disabled"}"
            ${this.canCurrentUserMarkDoneSelectedToken() ? "" : "disabled"}
          >
            Finish Turn
          </button>
          ${game.user.isGM ? `<div class="hs-exp-turn-secondary">
            <button type="button" data-action="hs-unlock-selected" class="hs-start-turn-timer">${(() => {
              const selected = canvas.tokens?.controlled || [];
              const allSelectedUnlocked = !!selected.length && selected.every((t) => this.isTokenUnlocked(t.id));
              return allSelectedUnlocked ? "Lock Selected" : "Unlock Selected";
            })()}</button>
            <button type="button" data-action="hs-unlock-all" class="hs-start-turn-timer">${(() => {
              const tokens = this.getEligibleTokens();
              const allUnlocked = !!tokens.length && tokens.every((t) => this.isTokenUnlocked(t.id));
              return allUnlocked ? "Lock All" : "Unlock All";
            })()}</button>
            <button type="button" data-action="hs-reset-selected-move" class="hs-start-turn-timer">Reset Selected Movement</button>
          </div>` : ""}
          ${game.user.isGM && this.getParallelPhase() === "environment"
            ? `<button type="button" data-action="hs-end-environment-turn" class="hs-start-turn-timer">End Environment Turn</button>`
            : ""}
        </div>
        ` : `
        <div class="hs-exp-turn-controls">
          <div class="hs-exp-turn-label">Turn Timer</div>
          <div class="hs-exp-timer-box">
            <span class="hs-exp-timer" data-hs-turn-timer>${this.getTurnTimerDisplay()}</span>
          </div>
          <button
            type="button"
            data-action="hs-start-turn-timer"
            class="hs-start-turn-timer ${this.canCurrentUserStartTurnTimer() ? "" : "disabled"}"
            ${this.canCurrentUserStartTurnTimer() ? "" : "disabled"}
          >
            Start Turn Timer
          </button>
        </div>
        `}
      </section>
    `;
  }
}

Hooks.on("preUpdateToken", (document, update) => {

  if (game.user.isGM && !HSExploration.isSimultaneousMode()) return;

  if (update.x === undefined && update.y === undefined) return;
  if (HSExploration._pendingGridMoveCommits) delete HSExploration._pendingGridMoveCommits[document.id];

  const allowed = HSExploration.allowMovement(document, update);

  if (!allowed) {
    const state = HSExploration.getState();

    if (HSExploration.isSimultaneousMode()) {
      const isGM = game.user.isGM;
      const isPlayerToken = !!(document?.actor?.hasPlayerOwner ?? document?.object?.actor?.hasPlayerOwner);
      const canControl = isGM || HSExploration.canUserControlToken(game.user.id, document.id);
      const isCapCase = state.active && !state.paused
        && HSExploration.getParallelPhase() === "player"
        && isPlayerToken
        && canControl
        && !HSExploration.isTokenDone(document.id);

      if (isCapCase) {
        const clamped = HSExploration.clampUpdateToRemainingMovement(document, update);
        if (clamped) {
          HSExploration.queuePendingGridMoveCommit(document, update);
          return;
        }
      }
    }

    let message = "Movement is currently locked.";

    if (HSExploration.isSimultaneousMode()) {
      if (!state.active || state.paused) {
        message = "Movement is locked until exploration resumes.";
      } else if (HSExploration.getParallelPhase() !== "player") {
        message = "Movement is locked during the environment phase.";
      } else if (!HSExploration.canUserControlToken(game.user.id, document.id)) {
        message = "You can only move a token you control.";
      } else if (HSExploration.isTokenDone(document.id)) {
        message = "That token is marked done for this phase.";
      } else {
        message = "That token has reached its movement cap.";
      }
    } else {
      const remaining = HSExploration.getRemainingTurnSeconds();
      message = (!state.active || state.paused || remaining === null || remaining <= 0)
        ? "Movement is locked until the next turn starts."
        : "It is not your exploration turn.";
    }

    ui.notifications.warn(message);

    delete update.x;
    delete update.y;

    return false;
  }

  if (HSExploration.isSimultaneousMode()) {
    HSExploration.queuePendingGridMoveCommit(document, update);
  }

});

Hooks.on("renderCombatTracker", (app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) {
    console.log("HS Exploration Initiative | no root");
    return;
  }

  console.log("HS Exploration Initiative | renderCombatTracker fired", root);

  const trackerTab = game.settings.get(MODULE_ID, "trackerTab") || "exploration";

  // Clean up accidental duplicates from earlier renders
  root.querySelectorAll(".hs-tracker-tabs").forEach((el, idx) => {
    if (idx > 0) el.remove();
  });
  root.querySelectorAll(".hs-exploration-container").forEach((el, idx) => {
    if (idx > 0) el.remove();
  });

  // Use very broad anchors first
  const header =
    root.querySelector("header") ||
    root.querySelector(".directory-header") ||
    root.firstElementChild ||
    root;

  // Foundry versions/themes vary a lot, so use multiple fallbacks
  let nativeList =
    root.querySelector("#combat-tracker") ||
    root.querySelector("ol.combat-tracker") ||
    root.querySelector("ol.directory-list") ||
    root.querySelector(".directory-list") ||
    root.querySelector(".combatants") ||
    root.querySelector("section") ||
    root.lastElementChild;

  console.log("HS Exploration Initiative | header", header);
  console.log("HS Exploration Initiative | nativeList", nativeList);

  if (!header || !nativeList) {
    console.log("HS Exploration Initiative | could not find header/nativeList");
    return;
  }

  let tabs = root.querySelector(".hs-tracker-tabs");
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.className = "hs-tracker-tabs";
    tabs.innerHTML = `
      <button type="button" class="hs-tab-btn" data-tab="exploration">Exploration</button>
      <button type="button" class="hs-tab-btn" data-tab="combat">Combat</button>
    `;
    root.prepend(tabs);
  }

  let expContainer = root.querySelector(".hs-exploration-container");
  if (!expContainer) {
    expContainer = document.createElement("div");
    expContainer.className = "hs-exploration-container";
    nativeList.parentNode.insertBefore(expContainer, nativeList);
  }

  const applyTrackerTabView = (tabName) => {
    const showExploration = tabName === "exploration";
    expContainer.style.display = showExploration ? "" : "none";
    nativeList.style.display = showExploration ? "none" : "";
    root.classList.toggle("hs-show-exploration", showExploration);
    root.classList.toggle("hs-show-combat", !showExploration);
    tabs.querySelectorAll(".hs-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
  };

  tabs.querySelectorAll(".hs-tab-btn").forEach(btn => {
    btn.onclick = async () => {
      const nextTab = btn.dataset.tab === "combat" ? "combat" : "exploration";
      applyTrackerTabView(nextTab);
      await HSExploration.setTrackerTab(nextTab);
    };
  });

  expContainer.innerHTML = HSExploration.buildExplorationMarkup();

  expContainer.querySelector("[data-action='hs-sync']")?.addEventListener("click", async () => {
    await HSExploration.syncParticipantsFromScene();
    ui.combat?.render(true);
  });

  expContainer.querySelector("[data-action='hs-start']")?.addEventListener("click", async () => {
    await HSExploration.startExploration();
  });

  expContainer.querySelector("[data-action='hs-select-all']")?.addEventListener("click", async () => {
    await HSExploration.selectAllParticipantTokens();
    ui.combat?.render(true);
  });

  expContainer.querySelector("[data-action='hs-clear-selection']")?.addEventListener("click", async () => {
    await HSExploration.clearSelectedTokens();
    ui.combat?.render(true);
  });

  expContainer.querySelector("[data-action='hs-next']")?.addEventListener("click", async () => {
    await HSExploration.nextTurn();
  });

  expContainer.querySelector("[data-action='hs-pause']")?.addEventListener("click", async () => {
    await HSExploration.pauseExploration();
  });

  expContainer.querySelector("[data-action='hs-resume']")?.addEventListener("click", async () => {
    await HSExploration.resumeExploration();
  });

  expContainer.querySelector("[data-action='hs-end']")?.addEventListener("click", async () => {
    await HSExploration.endExploration();
  });


  expContainer.querySelectorAll(".hs-exp-roll").forEach(button => {
    button.addEventListener("click", async (event) => {
      await HSExploration.requestRollParticipantInitiative(event.currentTarget.dataset.tokenId);
    });
  });

  expContainer.querySelectorAll(".hs-exp-row").forEach((row) => {
    row.addEventListener("click", async (event) => {
      if (event.target?.closest?.("button")) return;
      await HSExploration.focusParticipantToken(row.dataset.tokenId, { additive: !!event.shiftKey });
    });
  });

  expContainer.querySelector("[data-action='hs-start-turn-timer']")?.addEventListener("click", async () => {
    await HSExploration.requestStartTurnTimer();
  });

  expContainer.querySelector("[data-action='hs-done-selected']")?.addEventListener("click", async () => {
    await HSExploration.requestMarkDoneSelectedToken();
  });

  expContainer.querySelector("[data-action='hs-unlock-selected']")?.addEventListener("click", async () => {
    await HSExploration.toggleSelectedTokenMovementLock();
  });

  expContainer.querySelector("[data-action='hs-unlock-all']")?.addEventListener("click", async () => {
    await HSExploration.toggleAllTokenMovementLock();
  });

  expContainer.querySelector("[data-action='hs-reset-selected-move']")?.addEventListener("click", async () => {
    await HSExploration.resetSelectedTokenMovement();
  });

  expContainer.querySelector("[data-action='hs-end-environment-turn']")?.addEventListener("click", async () => {
    await HSExploration.endEnvironmentTurn();
  });
  applyTrackerTabView(trackerTab);
  if (!HSExploration.isSimultaneousMode()) {
    HSExploration.attachTurnTimerTicker(expContainer);
  } else {
    HSExploration.attachSimultaneousMovementTicker(expContainer);
  }
  HSExploration.updateMovementHud();

});


Hooks.on("updateToken", async (_document, change) => {
  if (!HSExploration.isSimultaneousMode()) return;
  if (change.x === undefined && change.y === undefined) return;

  const localCommit = HSExploration.consumePendingGridMoveCommit(_document);

  if (localCommit) {
    HSExploration.applyLocalCommittedMovement(
      _document.id,
      Number(_document.x),
      Number(_document.y),
      Number(localCommit.distance || 0)
    );
  }

  if (!game.user.isGM && localCommit) {
    game.socket?.emit(`module.${MODULE_ID}`, {
      type: "hs-record-grid-move",
      userId: game.user.id,
      tokenId: _document.id,
      x: Number(_document.x),
      y: Number(_document.y),
      distance: Number(localCommit.distance || 0)
    });
  }

  if (game.user.isGM) {
    let commit = localCommit;
    if (!commit) commit = await HSExploration.waitForRemoteGridMoveCommit(_document);
    if (commit) {
      HSExploration.applyLocalCommittedMovement(
        _document.id,
        Number(_document.x),
        Number(_document.y),
        Number(commit.distance || 0)
      );
    }
    await HSExploration.recordTokenMovement(_document, commit?.distance);
    await HSExploration.evaluateParallelPhaseCompletion();
  }

  HSExploration.clearGridDragSession(_document.id);
  HSExploration.updateMovementHud();
  ui.combat?.render(true);
});


Hooks.on("refreshToken", (token) => {
  if (!HSExploration.isSimultaneousMode()) return;
  const tokenId = token?.document?.id;
  if (!tokenId) return;

  if (HSExploration.canUserControlToken(game.user.id, tokenId)) {
    const preview = canvas.tokens?.preview?.children?.find?.((child) => child?.document?.id === tokenId);
    HSExploration.updateGridDragSession(preview || token);
  }

  // Update the floating HUD and any visible exploration lists immediately during drag.
  HSExploration.updateMovementHud();
  document.querySelectorAll(".hs-exploration-container").forEach((container) => {
    HSExploration.refreshRemainingMovementDisplay(container);
  });
});

Hooks.on("controlToken", () => {
  HSExploration.updateMovementHud();
  ui.combat?.render(true);
});

Hooks.on("closeCombatTracker", () => {
  HSExploration.clearUiTickers();
});

Hooks.on("combatStart", async () => {
  await HSExploration.pauseExplorationForCombatStart();
});

Hooks.on("updateCombat", async (combat, changed) => {
  if (!combat) return;
  const started = !!(combat.started || (Number(combat.round) > 0));
  const startTriggered = started && (changed?.round !== undefined || changed?.turn !== undefined || changed?.started !== undefined);
  if (!startTriggered) return;
  await HSExploration.pauseExplorationForCombatStart();
});

Hooks.once("init", () => {
  console.log("HS Exploration Initiative | INIT");

game.settings.register(MODULE_ID, "explorationMode", {
  scope: "world",
  config: false,
  type: String,
  default: "initiative"
});

game.settings.register(MODULE_ID, "parallelPhase", {
  scope: "world",
  config: false,
  type: String,
  default: "player"
});

game.settings.register(MODULE_ID, "parallelStartPositions", {
  scope: "world",
  config: false,
  type: Object,
  default: {}
});

game.settings.register(MODULE_ID, "parallelDoneTokenIds", {
  scope: "world",
  config: false,
  type: Array,
  default: []
});

game.settings.register(MODULE_ID, "parallelUnlockedTokenIds", {
  scope: "world",
  config: false,
  type: Array,
  default: []
});

game.settings.register(MODULE_ID, "parallelMovedDistance", {
  scope: "world",
  config: false,
  type: Object,
  default: {}
});

game.settings.register(MODULE_ID, "parallelLastPositions", {
  scope: "world",
  config: false,
  type: Object,
  default: {}
});

game.settings.register(MODULE_ID, "trackerTab", {
  scope: "client",
  config: false,
  type: String,
  default: "exploration"
});

game.settings.register(MODULE_ID, "explorationParticipants", {
  scope: "world",
  config: false,
  type: Array,
  default: []
});

game.settings.register(MODULE_ID, "explorationRound", {
  scope: "world",
  config: false,
  type: Number,
  default: 1
});

  game.settings.register(MODULE_ID, "explorationActive", {
  scope: "world",
  config: false,
  type: Boolean,
  default: false
});

game.settings.register(MODULE_ID, "explorationPaused", {
  scope: "world",
  config: false,
  type: Boolean,
  default: false
});

game.settings.register(MODULE_ID, "activeTokenId", {
  scope: "world",
  config: false,
  type: String,
  default: ""
});

game.settings.register(MODULE_ID, "turnOrder", {
  scope: "world",
  config: false,
  type: Array,
  default: []
});

game.settings.register(MODULE_ID, "turnIndex", {
  scope: "world",
  config: false,
  type: Number,
  default: 0
});

game.settings.register(MODULE_ID, "turnEndsAt", {
  scope: "world",
  config: false,
  type: Number,
  default: 0
});

  game.settings.register(MODULE_ID, "turnTime", {
    name: "Turn Time",
    hint: "How many seconds a player's exploration turn lasts.",
    scope: "world",
    config: false,
    type: Number,
    default: 30
  });

  game.settings.register(MODULE_ID, "separationDistance", {
    name: "Separation Distance",
    hint: "Distance in feet used to determine isolation at combat start.",
    scope: "world",
    config: false,
    type: Number,
    default: 60
  });

  game.settings.register(MODULE_ID, "movementMultiplier", {
    name: "Movement Multiplier",
    hint: "Multiplier applied to base movement speed in simultaneous mode.",
    scope: "world",
    config: false,
    type: Number,
    default: 1.5
  });

  game.settings.register(MODULE_ID, "disableCombatDisadvantage", {
    name: "Disable Combat Isolation Disadvantage",
    hint: "If enabled, the module will not apply isolation disadvantage behavior when combat starts.",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.registerMenu(MODULE_ID, "configMenu", {
    name: "Exploration Initiative Configuration",
    label: "Configure",
    hint: "Open HandsomeShrek's Exploration Initiative settings.",
    icon: "fas fa-compass",
    type: HSExplorationConfig,
    restricted: true
  });

  console.log("HS Exploration Initiative | settings + config menu registered");
});

Hooks.once("ready", () => {
  if (game.user.isGM) {
    if (HSExploration._turnExpiryTicker) clearInterval(HSExploration._turnExpiryTicker);
    HSExploration._turnExpiryTicker = setInterval(() => {
      void HSExploration.handleTurnTimerExpiry();
    }, 250);
  }
  game.socket?.on(`module.${MODULE_ID}`, HSExploration.onSocketMessage.bind(HSExploration));
  console.log("HS Exploration Initiative | READY");
});














