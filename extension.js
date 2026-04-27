import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';

export default class AutoCaptureScreenshotExtension extends Extension {
    enable() {
        const ui = Main.screenshotUI;
        if (!ui || !ui._areaSelector) return;

        const AreaSelectorClass = ui._areaSelector.constructor;
        const ScreenshotUIClass = ui.constructor;
        const ext = this;

        // --- PART 1: AUTO-CAPTURE ON RELEASE ---
        this._origStopDrag = AreaSelectorClass.prototype.stopDrag;
        this._isCapturing = false;

        AreaSelectorClass.prototype.stopDrag = function() {
            const wasClickWithoutDrag = (
                this._dragCursor === Clutter.CursorType.CROSSHAIR &&
                this._lastX === this._startX &&
                this._lastY === this._startY
            );

            ext._origStopDrag.apply(this, arguments);

            if (!ext._isCapturing && !wasClickWithoutDrag) {
                ext._isCapturing = true;
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    const activeUI = Main.screenshotUI;
                    if (activeUI && activeUI._captureButton && activeUI._captureButton.visible) {
                        activeUI._captureButton.emit('clicked', 0);
                    }
                    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                        ext._isCapturing = false;
                        return GLib.SOURCE_REMOVE;
                    });
                    return GLib.SOURCE_REMOVE;
                });
            }
        };

        // --- PART 2: MAKE INITIAL BOX INVISIBLE UNTIL DRAG ---
        this._origOnMotion = AreaSelectorClass.prototype._onMotion;
        AreaSelectorClass.prototype._onMotion = function() {
            // As soon as the user moves the mouse during a drag, show the selector
            if (this._dragButton > 0) {
                this.opacity = 255;
            }
            return ext._origOnMotion.apply(this, arguments);
        };

        const hideSelector = (container) => {
            if (container && container._areaSelector) {
                container._areaSelector.opacity = 0;
            }
        };

        this._origOnAreaButtonClicked = ScreenshotUIClass.prototype._onAreaButtonClicked;
        ScreenshotUIClass.prototype._onAreaButtonClicked = function() {
            ext._origOnAreaButtonClicked.apply(this, arguments);
            hideSelector(this);
        };

        this._origOpen = ScreenshotUIClass.prototype.open;
        ScreenshotUIClass.prototype.open = function() {
            const result = ext._origOpen.apply(this, arguments);
            hideSelector(this);
            return result;
        };
    }

    disable() {
        const ui = Main.screenshotUI;
        if (!ui) return;

        const AreaSelectorClass = ui._areaSelector.constructor;
        const UIClass = ui.constructor;

        if (this._origStopDrag) AreaSelectorClass.prototype.stopDrag = this._origStopDrag;
        if (this._origOnMotion) AreaSelectorClass.prototype._onMotion = this._origOnMotion;
        if (this._origOpen) UIClass.prototype.open = this._origOpen;
        if (this._origOnAreaButtonClicked) UIClass.prototype._onAreaButtonClicked = this._origOnAreaButtonClicked;

        if (ui._areaSelector) ui._areaSelector.opacity = 255;

        this._origStopDrag = null;
        this._origOnMotion = null;
        this._origOpen = null;
        this._origOnAreaButtonClicked = null;
    }
}
