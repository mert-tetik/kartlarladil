import {
  dispatchTutorialCardLayerAddAttempted,
  type TutorialCardLayer,
} from "@/features/tutorial/tutorial-card-session";
import { useTutorialStore } from "@/features/tutorial/tutorial-store";

const { sendTwaAnalyticsEventMock, trackAnalyticsEventMock } = vi.hoisted(() => ({
  sendTwaAnalyticsEventMock: vi.fn(),
  trackAnalyticsEventMock: vi.fn(),
}));

vi.mock("@/lib/analytics-events", () => ({
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock("@/lib/twa-analytics", () => ({
  sendTwaAnalyticsEvent: sendTwaAnalyticsEventMock,
}));

describe("tutorial card session analytics", () => {
  beforeEach(() => {
    sendTwaAnalyticsEventMock.mockClear();
    trackAnalyticsEventMock.mockClear();
    useTutorialStore.setState({
      active: true,
      completed: false,
      introSeen: true,
      step: 0,
      testMode: false,
    });
  });

  afterEach(() => {
    useTutorialStore.setState({
      active: false,
      completed: false,
      introSeen: false,
      step: 0,
      testMode: false,
    });
  });

  it.each([
    ["draw-cards", "random"],
    ["custom-card", "custom"],
    ["card-groups", "group"],
  ] as const)("records %s card additions with its method", (layer: TutorialCardLayer, method) => {
    dispatchTutorialCardLayerAddAttempted({ layer, count: 4 });

    expect(trackAnalyticsEventMock).toHaveBeenCalledWith("tutorial_cards_added", {
      method,
      added_count: 4,
    });
    expect(sendTwaAnalyticsEventMock).toHaveBeenCalledWith("fd_tutorial_cards_added", {
      params: {
        method,
        added_count: 4,
      },
    });
  });

  it("does not record additions from tutorial test mode", () => {
    useTutorialStore.setState({ testMode: true });

    dispatchTutorialCardLayerAddAttempted({ layer: "draw-cards", count: 1 });

    expect(trackAnalyticsEventMock).not.toHaveBeenCalled();
    expect(sendTwaAnalyticsEventMock).not.toHaveBeenCalled();
  });
});
