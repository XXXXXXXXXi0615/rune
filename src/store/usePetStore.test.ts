import { beforeEach, describe, expect, it } from "vitest";
import { usePetStore } from "./usePetStore";

describe("desktop pet preferences", () => {
  beforeEach(() =>
    usePetStore.setState({
      selectedPetId: "clawd",
      roomPositionsByPet: {},
      desktopPositions: {},
      favoritePresentationIdsByPet: { clawd: [], jiyi: [] },
      recentPresentationIdsByPet: { clawd: [], jiyi: [] },
      manualPreviewOverrides: {},
    }),
  );

  it("isolates room positions by pet and room", () => {
    const store = usePetStore.getState();
    store.setRoomPosition("bed", { x: 0.2, y: 0.3 }, "jiyi");
    store.setRoomPosition("bed", { x: 0.7, y: 0.8 }, "clawd");
    const next = usePetStore.getState().roomPositionsByPet;
    expect(next.jiyi?.bed).toEqual({ x: 0.2, y: 0.3 });
    expect(next.clawd?.bed).toEqual({ x: 0.7, y: 0.8 });
  });

  it("switches selected pet without overwriting another position", () => {
    usePetStore.getState().setDesktopPosition("clawd", { x: 10, y: 20 });
    usePetStore.getState().setSelectedPetId("jiyi");
    usePetStore.getState().setDesktopPosition("jiyi", { x: 30, y: 40 });
    expect(usePetStore.getState().desktopPositions).toEqual({
      clawd: { x: 10, y: 20 },
      jiyi: { x: 30, y: 40 },
    });
  });

  it("keeps independent normalized behavior preferences per pet", () => {
    const store = usePetStore.getState();
    store.setPetPreference("clawd", {
      ...store.petPreferences.clawd,
      behaviorMode: "manual",
      expressionId: "happy",
      actionId: "happy",
    });
    store.setPetPreference("jiyi", {
      ...store.petPreferences.jiyi,
      behaviorMode: "manual",
      expressionId: "tired",
      actionId: "sleep",
    });
    expect(usePetStore.getState().petPreferences.clawd.actionId).toBe("happy");
    expect(usePetStore.getState().petPreferences.jiyi.actionId).toBe("sleep");
  });

  it("persists favorites independently for each pet", () => {
    const store = usePetStore.getState();
    store.togglePresentationFavorite("clawd", "clawd-singing");
    store.togglePresentationFavorite("jiyi", "sleep");
    expect(usePetStore.getState().favoritePresentationIdsByPet).toEqual({
      clawd: ["clawd-singing"],
      jiyi: ["sleep"],
    });
  });

  it("keeps a deduplicated recent presentation list", () => {
    const store = usePetStore.getState();
    store.markPresentationUsed("clawd", "clawd-singing");
    store.markPresentationUsed("clawd", "clawd-skateboard");
    store.markPresentationUsed("clawd", "clawd-singing");
    expect(usePetStore.getState().recentPresentationIdsByPet.clawd).toEqual([
      "clawd-singing",
      "clawd-skateboard",
    ]);
  });

  it("applies the settings draft atomically and only then records recent use", () => {
    const before = usePetStore.getState();
    expect(before.recentPresentationIdsByPet.clawd).toEqual([]);
    before.applyDesktopPetSettings({
      selectedPetId: "clawd",
      placementMode: "desktop-only",
      animationEnabled: false,
      dialogAvoidance: false,
      preference: {
        ...before.petPreferences.clawd,
        behaviorMode: "manual",
        presentationId: "clawd-working-typing",
      },
    });
    const after = usePetStore.getState();
    expect(after).toMatchObject({
      selectedPetId: "clawd",
      placementMode: "desktop-only",
      animationEnabled: false,
      dialogAvoidance: false,
    });
    expect(after.petPreferences.clawd.presentationId).toBe(
      "clawd-working-typing",
    );
    expect(after.recentPresentationIdsByPet.clawd[0]).toBe(
      "clawd-working-typing",
    );
  });
  it("keeps auto selection temporary and pinning converts it to persistent manual mode", () => {
    const store = usePetStore.getState();
    store.setPetPreference("clawd", { ...store.petPreferences.clawd, behaviorMode: "automatic" });
    store.previewPresentation("clawd", "clawd-error-runtime", 15_000);
    expect(
      usePetStore.getState().manualPreviewOverrides.clawd?.presentationId,
    ).toBe("clawd-error-runtime");
    expect(usePetStore.getState().petPreferences.clawd.behaviorMode).not.toBe(
      "manual",
    );
    usePetStore.getState().pinPresentation("clawd", "clawd-error-runtime");
    expect(usePetStore.getState().manualPreviewOverrides.clawd).toBeUndefined();
    expect(usePetStore.getState().petPreferences.clawd).toMatchObject({
      behaviorMode: "manual",
      presentationId: "clawd-error-runtime",
    });
  });
});
