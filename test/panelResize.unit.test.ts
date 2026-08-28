import test from "node:test";
import assert from "node:assert/strict";
import { MIN_PANEL_WIDTH, resizedPanelWidth } from "../web/src/panelResize.ts";

test("thread panel can use all available space while preserving the chat minimum", () => {
  assert.equal(resizedPanelWidth("traj", 320, 900, 1440, 248), 856);
});

test("thread panel still keeps both panes usable on a narrow viewport", () => {
  assert.equal(resizedPanelWidth("traj", 320, 900, 700, 248), MIN_PANEL_WIDTH);
  assert.equal(resizedPanelWidth("traj", 320, -900, 1440, 248), MIN_PANEL_WIDTH);
});

test("sidebar retains its existing maximum width", () => {
  assert.equal(resizedPanelWidth("sb", 248, 900, 1440, 248), 560);
});
