# HandsomeShrek's Exploration Initiative

HandsomeShrek's Exploration Initiative is a Foundry VTT module that adds a dedicated exploration tracker alongside the combat tracker, giving GMs a structured way to run out-of-combat rounds, simultaneous movement, and encounter setup without forcing everything through standard combat.

## Features

- Adds separate **Exploration** and **Combat** tabs to the combat tracker
- Supports initiative-style exploration turns
- Supports simultaneous movement mode for party-wide exploration
- Tracks per-token movement during simultaneous exploration
- Lets GMs finish turns, lock or unlock movement, and reset movement for selected tokens
- Supports multi-token selection directly from the exploration tab
- Preserves exploration state and round count when combat begins
- Pauses exploration when combat actually starts, instead of when an encounter is merely created

## Why Use It

TThis module is built for groups that want exploration to feel organized and visible at the table. Instead of loosely tracking movement and turns by hand, the GM gets a dedicated tracker for who is acting, who is done, how much movement has been used, and how exploration should resume after combat. It is especially useful for parties with one wildcard player who loves to wander off during exploration, giving the GM a clear way to track movement, pace, and group flow without losing control of the scene.

## Basic Usage

1. Open the **Exploration** tab in the combat tracker.
2. Click **Sync PCs** to pull player tokens from the current scene.
3. Choose either initiative turns or simultaneous movement in the module configuration.
4. Click **Start Exploration**.
5. Use the tracker controls to manage movement, finish turns, pause or resume exploration, and handle transitions into combat.

## Simultaneous Mode

- Configurable movement multiplier
- Per-token movement limits
- **Finish Turn** for one or many selected tokens
- GM tools for **Unlock Selected**, **Unlock All**, and **Reset Selected Movement**
- Selection tools such as **Select All PCs** and **Clear Selection**

## Combat Integration

When combat starts, exploration is paused rather than wiped. This keeps exploration rounds and state intact so play can resume cleanly after the encounter ends.

## Notes

- Built for Foundry Virtual Tabletop
- Best experience in simultaneous mode is on gridded maps
- Some features depend on token ownership and GM permissions
