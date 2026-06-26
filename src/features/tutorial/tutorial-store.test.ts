import { useTutorialStore } from "@/features/tutorial/tutorial-store";

describe("useTutorialStore", () => {
  beforeEach(() => {
    useTutorialStore.setState({ completed: false, step: 0 });
  });

  it("starts at step 0 and not completed", () => {
    const state = useTutorialStore.getState();

    expect(state.step).toBe(0);
    expect(state.completed).toBe(false);
  });

  it("advances through steps", () => {
    const { advance } = useTutorialStore.getState();

    advance();
    expect(useTutorialStore.getState().step).toBe(1);

    advance();
    expect(useTutorialStore.getState().step).toBe(2);
  });

  it("marks completed after the final step", () => {
    const { advance } = useTutorialStore.getState();

    for (let i = 0; i < 7; i += 1) {
      advance();
    }

    expect(useTutorialStore.getState().step).toBe(7);
    expect(useTutorialStore.getState().completed).toBe(true);
  });

  it("resets to the initial state", () => {
    const { advance, reset } = useTutorialStore.getState();

    advance();
    advance();
    reset();

    expect(useTutorialStore.getState().step).toBe(0);
    expect(useTutorialStore.getState().completed).toBe(false);
  });
});
