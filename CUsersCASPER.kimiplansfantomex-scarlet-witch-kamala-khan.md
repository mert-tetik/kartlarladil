# Card Draw Filter Bug Fix Plan

## Problem Summary
- `initialLanguage`/`initialTier` URL props are overridden by localStorage values
- Mobile FilterControls hidden when `hasInitialFilters` is true
- URL and localStorage out of sync when filters change

## Root Cause
1. `parseStoredPreferences` always uses localStorage if it exists, ignoring URL props
2. `hasInitialFilters && "max-lg:hidden"` hides filters on mobile landing navigation
3. `updatePreferences` writes to localStorage but never updates the URL

## Proposed Fix

### 1. Priority Fix: URL Props Override localStorage on Initial Load
**File:** `src/features/cards/components/card-draw-workbench.tsx`

When `initialLanguage` or `initialTier` props are provided and differ from localStorage:
- Update localStorage to match the URL props
- This ensures the URL is the source of truth on page load

### 2. Mobile Fix: Remove FilterControls Hiding on Mobile
**File:** `src/features/cards/components/card-draw-workbench.tsx`

Remove or modify the `hasInitialFilters && "max-lg:hidden"` className.
Instead, always show FilterControls on mobile so users can correct filters.

### 3. Sync Fix: Update URL When Filters Change
**File:** `src/features/cards/components/card-draw-workbench.tsx`

In `updatePreferences`, after writing to localStorage, also update the URL via `router.push` or `router.replace` with the new query params. Use `replace` to avoid polluting history.

### 4. Edge Case: Clear URL Props After First Application
After applying initial URL props to state, clear them from the URL (or keep them) so subsequent filter changes work correctly. Keeping them is fine if we sync on every change.

## Implementation Steps
1. Read `card-draw-workbench.tsx` to understand current code exactly
2. Modify `preferences` initialization to respect URL props over localStorage
3. Remove mobile filter hiding
4. Add `router.replace` in `updatePreferences`
5. Test with `npm run typecheck` and `npm run test`
6. Commit and push

## Risk Mitigation
- Only touches `card-draw-workbench.tsx` - isolated change
- Existing `localStorage` key format unchanged
- `draw-deck` key format (`language:tier`) already handles different combos correctly
- Backward compatible: users without URL props behave exactly as before
