# Third-Party Audio

FoxiesDeck previously shipped short UI/game sound effects as MP3 files in `public/sounds/`.
These have been replaced with synthesized Web Audio API effects defined in `src/lib/sound-effects.ts`.

The current sound effects are generated in-browser using oscillators and noise buffers, so no
third-party audio assets are bundled with the app anymore.

## Historical inventory

The files below were used before the switch to synthesized audio. They were downloaded on
**2026-06-20**, trimmed for short in-app playback, lightly peak-limited with `ffmpeg`, and
re-encoded to MP3 for web delivery.

| Effect key | Shipped file | Source title | Source page | Original asset URL |
| --- | --- | --- | --- | --- |
| `incorrect` | `public/sounds/incorrect.mp3` | Wrong answer fail notification | https://mixkit.co/free-sound-effects/game-show/ | https://assets.mixkit.co/active_storage/sfx/946/946.wav |
| `rank-up` | `public/sounds/rank-up.mp3` | Video game win | https://mixkit.co/free-sound-effects/win/ | https://assets.mixkit.co/active_storage/sfx/2016/2016.wav |
| `points` | `public/sounds/points.mp3` | Winning a coin, video game | https://mixkit.co/free-sound-effects/coin/ | https://assets.mixkit.co/active_storage/sfx/2069/2069.wav |
| `learned` | `public/sounds/learned.mp3` | Unlock game notification | https://mixkit.co/free-sound-effects/win/ | https://assets.mixkit.co/active_storage/sfx/253/253.wav |
| `confetti` | `public/sounds/confetti.mp3` | Fairy arcade sparkle | https://mixkit.co/free-sound-effects/sparkle/ | https://assets.mixkit.co/active_storage/sfx/866/866.wav |
| `quiz-complete` | `public/sounds/quiz-complete.mp3` | Positive notification | https://mixkit.co/free-sound-effects/game-show/ | https://assets.mixkit.co/active_storage/sfx/951/951.wav |
| `chest-tap` | `public/sounds/chest-tap.mp3` | Wood hard hit | https://mixkit.co/free-sound-effects/wood/ | https://assets.mixkit.co/active_storage/sfx/2182/2182.wav |
| `chest-open` | `public/sounds/chest-open.mp3` | Old medieval door lock | https://mixkit.co/free-sound-effects/wood/ | https://assets.mixkit.co/active_storage/sfx/187/187.wav |

## License (historical)

- Provider: Mixkit
- License page: https://mixkit.co/license/
- Asset type: Sound Effects / Free License
- Commercial use: allowed
- Attribution: not required

No visible attribution is required for these historical sound effects under the Mixkit Sound Effects Free License.
