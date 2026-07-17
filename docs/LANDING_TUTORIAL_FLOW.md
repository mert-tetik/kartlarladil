# Mobile Landing Tutorial Flow

This is the current first-use tutorial for mobile users. It deliberately replaces the former pointer-based, route-changing tutorial. The tutorial is implemented by `LandingTutorial` and all eight steps remain on `/`.

## Display Conditions

- It uses the existing first-login trigger in `MobileAuthGateway`: the mobile login reset flag resets and activates the tutorial after onboarding is complete.
- It is visible only below the desktop breakpoint (`1023px`) and only on the landing page.
- A completed tutorial does not return unless the existing reset trigger runs again.
- `?tutorial-test=1` or `?tutorial-debug=1` resets the tutorial and enables the test flow for visual QA.

## Steps

| Step | Target | Turkish copy | Next color |
| --- | --- | --- | --- |
| 1 | Random card draw icon | Rastgele kartları koleksiyonuna ekle | Green |
| 2 | Custom-card icon | Veya istediğin kelimeyi ekle | Blue |
| 3 | Cards dropdown | Kart koleksiyonunu gör | Red |
| 4 | Start learning button | Koleksiyonuna çalış ve kelimelerini öğren | Yellow |
| 5 | Review learned button | Öğrendiğin kelimeleri tekrar et | Green |
| 6 | Rank area | Kelime öğrendikçe puan kazan ve rütbe atla | Blue |
| 7 | Leaderboard button | Puanlarla dünya sıralamasına gir! | Red |
| 8 | Games item in the mobile bottom bar | Kelime oyunları oynarken öğren ve puan kazan! | Yellow |

## Interaction Rules

- The tutorial covers the complete viewport. All underlying controls, including the highlighted target, are blocked.
- The highlighted target is revealed through a circular spotlight with a red outline. The rest of the screen is darkened.
- For lower-screen targets, the message is directly above the spotlight and the next button is placed at the top. For upper-screen targets, those positions are reversed.
- The final action uses the localized `Anlaşıldı` label instead of `Sonraki`.
