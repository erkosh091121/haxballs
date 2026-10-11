# HaxBall AI training roadmap

## Current stage: collect match telemetry

The browser game now records a compact sample of each bot's decisions at up to 4 samples per second per bot. Samples include the ball state, player state, teammate/opponent positions, chosen high-level action, and a possible pass receiver. Goal events are recorded separately.

This is **data collection, not neural-network training**. The existing bot still chooses actions using its hand-written tactical logic.

## Test the recorder

1. Open the game from the `team-ai-training` branch in the browser.
2. Start a match with bots and let them play for a while.
3. Open Chrome DevTools with `F12`, then select Console.
4. Run:
   ```js
   downloadAITrainingData()
   ```
5. The browser should download `haxball-ai-training-data.json`. Keep a few short match files; don't publish files containing private chat or personal data.

To clear collected data in the current page, run `clearAITrainingData()`.

## Planned training stages

1. **Validate telemetry:** confirm actions and goals are recorded and that the game remains stable.
2. **Build a reproducible simulator:** match the game's movement, ball friction, collisions, kick strength, goals and boundaries. Avoid training in a simulator that behaves very differently from the browser game.
3. **Define rewards:** reward goals, useful passes, through-balls that create chances, assists, successful interceptions, and team shape; penalize turnovers, blocked passes, bad shots, and defensive mistakes. Avoid rewards that encourage endless passing or selfish shooting.
4. **Self-play:** train both teams against each other with reinforcement learning (PPO is one candidate), using randomized starting states and opponents of different strengths.
5. **Evaluate:** compare against fixed baselines over many matches, not just one lucky game. Track win rate, goals, completed passes, through-ball success, turnovers, and defensive errors.
6. **Deploy:** export a compact policy to a browser-compatible format and keep a rule-based fallback if inference fails.

## Important design rule

The team needs shared tactical intent (roles, spacing, press/cover, receiver selection), while each player needs local movement and ball-control decisions. A model should learn on top of stable physics and a clearly defined action space; adding a neural network to the HTML alone does not create a trained football AI.
