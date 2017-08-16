import $ from 'jquery';
import _cloneDeep from 'lodash/cloneDeep';
import _forEach from 'lodash/forEach';
import _has from 'lodash/has';
import _filter from 'lodash/filter';
import AirportController from '../airport/AirportController';
import GameController from '../game/GameController';
import UiController from '../UiController';
import EventBus from '../lib/EventBus';
import { tau } from '../math/circle';
import { distance2d } from '../math/distance';
import {
    sin,
    cos,
    round,
    calculateMiddle,
    extrapolate_range_clamp,
    clamp
} from '../math/core';
import {
    positive_intersection_with_rect,
    vadd,
    vectorize_2d,
    vscale
} from '../math/vector';
import { leftPad } from '../utilities/generalUtilities';
import { time } from '../utilities/timeHelpers';
import {
    degreesToRadians,
    km,
    km_to_px
} from '../utilities/unitConverters';
import {
    FLIGHT_PHASE,
    FLIGHT_CATEGORY
} from '../constants/aircraftConstants';
import {
    BASE_CANVAS_FONT,
    DEFAULT_CANVAS_SIZE
} from '../constants/canvasConstants';
import { THEME } from '../constants/themes';
import { EVENT } from '../constants/eventNames';
import {
    INVALID_INDEX,
    INVALID_NUMBER,
    TIME
} from '../constants/globalConstants';
import { SELECTORS } from '../constants/selectors';
import { LOG } from '../constants/logLevel';

// Temporary const declaration here to attach to the window AND use as internal property
const canvas = {};

/**
 * @class CanvasController
 */
export default class CanvasController {
    /**
     * @constructor
     * @param $element {JQuery|HTML Element|undefined}
     * @param navigationLibrary {NavigationLibrary}
     */
    constructor($element, navigationLibrary) {
        this.$window = $(window);
        this.$element = $element;

        this._navigationLibrary = navigationLibrary;
        this._eventBus = EventBus;

        prop.canvas = canvas;
        this.canvas = canvas;
        this.canvas.contexts = {};
        this.canvas.panY = 0;
        this.canvas.panX = 0;
        // resize canvas to fit window?
        this.canvas.resize = true;
        // all canvases are the same size
        this.canvas.size = {
            height: DEFAULT_CANVAS_SIZE.HEIGHT,
            width: DEFAULT_CANVAS_SIZE.WIDTH
        };
        this.canvas.last = time();
        this.canvas.dirty = true;
        this.canvas.draw_labels = false;
        this.canvas.draw_restricted = false;
        this.canvas.draw_sids = false;
        this.canvas.draw_terrain = true;

        this.theme = THEME.DEFAULT;

        return this._init()
            .enable();
    }

    /**
     * @for CanvasController
     * @method _init
     */
    _init() {
        return this;
    }

    /**
     * @for CanvasController
     * @method enable
     */
    enable() {
        this._eventBus.on(EVENT.REQUEST_TO_CENTER_POINT_IN_VIEW, this._onCenterPointInView);
        this._eventBus.on(EVENT.SET_THEME, this._setTheme);

        return this;
    }

    /**
     * @for CanvasController
     * @method disable
     */
    disable() {
        return this.destroy();
    }

    /**
     * @for CanvasController
     * @method destroy
     */
    destroy() {
        this.$window = null;
        this.$element = null;
        this.canvas = {};
        this.canvas.contexts = {};
        this.canvas.panY = 0;
        this.canvas.panX = 0;
        // resize canvas to fit window?
        this.canvas.resize = true;
        // all canvases are the same size
        this.canvas.size = {
            height: DEFAULT_CANVAS_SIZE.HEIGHT,
            width: DEFAULT_CANVAS_SIZE.WIDTH
        };
        this.canvas.last = time();
        this.canvas.dirty = true;
        this.canvas.draw_labels = false;
        this.canvas.draw_restricted = false;
        this.canvas.draw_sids = false;
        this.canvas.draw_terrain = true;

        return this;
    }

    /**
     * @for CanvasController
     * @method canvas_init_pre
     */
    canvas_init_pre() {
        return this;
    }

    /**
     * @for CanvasController
     * @method canvas_init
     */
    canvas_init() {
        this.canvas_add('navaids');
    }

    /**
     * @for CanvasController
     * @method canvas_adjust_hidpi
     */
    canvas_adjust_hidpi() {
        const dpr = window.devicePixelRatio || 1;

        log(`devicePixelRatio: ${dpr}`);

        // TODO: change to early return
        if (dpr <= 1) {
            return;
        }

        // TODO: cache this selector, $hidefCanvas
        // TODO: replace selector with constant
        const hidefCanvas = $(SELECTORS.DOM_SELECTORS.NAVAIDS_CANVAS).get(0);
        const w = this.canvas.size.width;
        const h = this.canvas.size.height;

        $(hidefCanvas).attr('width', w * dpr);
        $(hidefCanvas).attr('height', h * dpr);
        $(hidefCanvas).css('width', w);
        $(hidefCanvas).css('height', h);

        const ctx = hidefCanvas.getContext('2d');

        ctx.scale(dpr, dpr);
        this.canvas.contexts.navaids = ctx;
    }

    /**
     * @for CanvasController
     * @method
     */
    canvas_complete() {
        setTimeout(() => {
            this.canvas.dirty = true;
        }, 500);

        this.canvas.last = time();
    }

    /**
     * @for CanvasController
     * @method
     */
    canvas_resize() {
        if (this.canvas.resize) {
            this.canvas.size.width = this.$window.width();
            this.canvas.size.height = this.$window.height();
        }

        // this.canvas.size.width -= 400;
        this.canvas.size.height -= 36;

        _forEach(this.canvas.contexts, (context) => {
            context.canvas.height = this.canvas.size.height;
            context.canvas.width = this.canvas.size.width;
        });

        this.canvas.dirty = true;
        this.canvas_adjust_hidpi();
    }

    /**
     * @for CanvasController
     * @method canvas_update_post
     */
    canvas_update_post() {
        const elapsed = GameController.game_time() - AirportController.airport_get().start;
        const alpha = extrapolate_range_clamp(0.1, elapsed, 0.4, 0, 1);
        const framestep = Math.round(extrapolate_range_clamp(1, GameController.game.speedup, 10, 30, 1));

        if (this.canvas.dirty || (!GameController.game_paused() && prop.time.frames % framestep === 0) || elapsed < 1) {
            const cc = this.canvas_get('navaids');
            const fading = elapsed < 1;

            cc.font = '11px monoOne, monospace';

            // TODO: what is the rationale here? with two ors and a true, this block will always be exectuted.
            if (this.canvas.dirty || fading || true) {
                cc.save();

                this.canvas_clear(cc);
                this.canvas_fill_background(cc);
                cc.translate(
                    calculateMiddle(this.canvas.size.width),
                    calculateMiddle(this.canvas.size.height)
                );
                cc.save();

                cc.globalAlpha = alpha;

                this.canvas_draw_videoMap(cc);
                this.canvas_draw_terrain(cc);
                this.canvas_draw_restricted(cc);
                this.canvas_draw_runways(cc);
                cc.restore();

                cc.save();

                cc.globalAlpha = alpha;

                this.canvas_draw_fixes(cc);
                this.canvas_draw_sids(cc);
                cc.restore();
                cc.restore();
            }

            // Controlled traffic region - (CTR)
            cc.save();
            // translate to airport center
            cc.translate(
                round(this.canvas.size.width / 2 + this.canvas.panX),
                round(this.canvas.size.height / 2 + this.canvas.panY)
            );
            // TODO: this is incorrect usage of a ternary. ternaries should be used for a ssignment not function calls.
            // draw airspace border
            AirportController.airport_get().airspace
                ? this.canvas_draw_airspace_border(cc)
                : this.canvas_draw_ctr(cc);

            this.canvas_draw_range_rings(cc);
            cc.restore();

            // Special markings for ENGM point merge
            if (AirportController.airport_get().icao === 'ENGM') {
                cc.save();
                cc.translate(
                    calculateMiddle(this.canvas.size.width),
                    calculateMiddle(this.canvas.size.height)
                );
                this.canvas_draw_engm_range_rings(cc);
                cc.restore();
            }

            // Compass
            cc.font = 'bold 10px monoOne, monospace';

            if (this.canvas.dirty || fading || true) {
                cc.save();
                cc.translate(
                    calculateMiddle(this.canvas.size.width),
                    calculateMiddle(this.canvas.size.height)
                );

                this.canvas_draw_compass(cc);
                cc.restore();
            }

            cc.font = BASE_CANVAS_FONT;

            if (this.canvas.dirty || this.canvas_should_draw() || true) {
                cc.save();
                cc.globalAlpha = alpha;
                cc.translate(
                    calculateMiddle(this.canvas.size.width),
                    calculateMiddle(this.canvas.size.height)
                );
                this.canvas_draw_all_aircraft(cc);
                cc.restore();
            }

            cc.save();
            cc.globalAlpha = alpha;
            cc.translate(
                calculateMiddle(this.canvas.size.width),
                calculateMiddle(this.canvas.size.height)
            );
            this.canvas_draw_all_info(cc);
            cc.restore();

            cc.save();
            cc.globalAlpha = alpha;
            cc.translate(
                calculateMiddle(this.canvas.size.width),
                calculateMiddle(this.canvas.size.height)
            );

            this.canvas_draw_runway_labels(cc);
            cc.restore();

            cc.save();
            cc.globalAlpha = alpha;
            this.canvas_draw_scale(cc);
            cc.restore();

            cc.save();
            cc.globalAlpha = alpha;
            this.canvas_draw_directions(cc);
            cc.restore();

            this.canvas.dirty = false;
        }
    }

    /**
     * @for CanvasController
     * @method canvas_add
     * @param name {string}
     */
    canvas_add(name) {
        $(SELECTORS.DOM_SELECTORS.CANVASES).append(`<canvas id='${name}-canvas'></canvas>`);
        this.canvas.contexts[name] = $(`#${name}-canvas`).get(0).getContext('2d');
    }

    /**
     * @for CanvasController
     * @method canvas_get
     * @param name {string}
     */
    canvas_get(name) {
        return this.canvas.contexts[name];
    }

    /**
     * @for CanvasController
     * @method canvas_clear
     * @param cc {object}
     */
    canvas_clear(cc) {
        cc.clearRect(0, 0, this.canvas.size.width, this.canvas.size.height);
    }

    /**
     * @for CanvasController
     * @method canvas_should_draw
     */
    canvas_should_draw() {
        const elapsed = time() - this.canvas.last;

        if (elapsed > (1 / GameController.game.speedup)) {
            this.canvas.last = time();
            return true;
        }

        return false;
    }

    /**
     * Fill entire scope with the background color specified in the current theme
     *
     * @for CanvasController
     * @method canvas_fill_background
     * @param cc {Object} HTML5 canvas context
     */
    canvas_fill_background(cc) {
        cc.fillStyle = this.theme.SCOPE.BACKGROUND;

        cc.fillRect(0, 0, this.canvas.size.width, this.canvas.size.height);
    }

    /**
     * @for CanvasController
     * @method canvas_draw_runway
     * @param cc
     * @param runway
     * @param mode
     */
    canvas_draw_runway(cc, runway, mode) {
        const length2 = round(UiController.km_to_px(runway.length / 2));
        const angle = runway.angle;

        cc.translate(
            round(UiController.km_to_px(runway.relativePosition[0])) + this.canvas.panX,
            -round(UiController.km_to_px(runway.relativePosition[1])) + this.canvas.panY
        );
        cc.rotate(angle);

        // runway body
        if (!mode) {
            cc.strokeStyle = '#899';
            cc.lineWidth = 2.8;

            cc.beginPath();
            cc.moveTo(0, 0);
            cc.lineTo(0, -2 * length2);
            cc.stroke();
        } else {
            // extended centerlines
            if (!runway.ils.enabled) {
                return;
            }

            cc.strokeStyle = this.theme.SCOPE.RUNWAY_EXTENDED_CENTERLINE;
            cc.lineWidth = 1;

            cc.beginPath();
            cc.moveTo(0, 0);
            cc.lineTo(0, UiController.km_to_px(runway.ils.loc_maxDist));
            cc.stroke();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_runway_label
     * @param cc
     * @param runway
     */
    canvas_draw_runway_label(cc, runway) {
        const length2 = round(UiController.km_to_px(runway.length / 2)) + 0.5;
        const angle = runway.angle;
        const text_height = 14;

        cc.translate(
            round(UiController.km_to_px(runway.relativePosition[0])) + this.canvas.panX,
            -round(UiController.km_to_px(runway.relativePosition[1])) + this.canvas.panY
        );
        cc.rotate(angle);

        cc.textAlign = 'center';
        cc.textBaseline = 'middle';

        cc.save();
        cc.translate(
            0,
            length2 + text_height
        );
        cc.rotate(-angle);
        cc.translate(
            round(UiController.km_to_px(runway.labelPos[0])),
            -round(UiController.km_to_px(runway.labelPos[1]))
        );
        cc.fillText(runway.name, 0, 0);
        cc.restore();
    }

    /**
     * @for CanvasController
     * @method canvas_draw_runways
     * @param cc
     */
    canvas_draw_runways(cc) {
        if (!this.canvas.draw_labels) {
            return;
        }

        cc.strokeStyle = this.theme.SCOPE.RUNWAY;
        cc.fillStyle = this.theme.SCOPE.RUNWAY;
        cc.lineWidth = 4;

        const airport = AirportController.airport_get();

        // Extended Centerlines
        for (let i = 0; i < airport.runways.length; i++) {
            cc.save();
            this.canvas_draw_runway(cc, airport.runways[i][0], true);
            cc.restore();

            cc.save();
            this.canvas_draw_runway(cc, airport.runways[i][1], true);
            cc.restore();
        }

        // Runways
        for (let i = 0; i < airport.runways.length; i++) {
            cc.save();
            this.canvas_draw_runway(cc, airport.runways[i][0], false);
            cc.restore();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_runway_labels
     * @param cc
     */
    canvas_draw_runway_labels(cc) {
        if (!this.canvas.draw_labels) {
            return;
        }

        const airport = AirportController.airport_get();

        cc.fillStyle = this.theme.SCOPE.RUNWAY_LABELS;

        for (let i = 0; i < airport.runways.length; i++) {
            cc.save();
            this.canvas_draw_runway_label(cc, airport.runways[i][0]);
            cc.restore();
            cc.save();
            this.canvas_draw_runway_label(cc, airport.runways[i][1]);
            cc.restore();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_scale
     * @param cc
     */
    canvas_draw_scale(cc) {
        cc.fillStyle = this.theme.SCOPE.TOP_ROW_TEXT;
        cc.strokeStyle = this.theme.SCOPE.TOP_ROW_TEXT;

        const offset = 10;
        const height = 5;
        const length = round(1 / UiController.scale * 50);
        const px_length = round(UiController.km_to_px(length));

        cc.translate(0.5, 0.5);

        cc.lineWidth = 1;
        cc.moveTo(this.canvas.size.width - offset, offset);
        cc.lineTo(this.canvas.size.width - offset, offset + height);
        cc.lineTo(this.canvas.size.width - offset - px_length, offset + height);
        cc.lineTo(this.canvas.size.width - offset - px_length, offset);
        cc.stroke();

        cc.translate(-0.5, -0.5);

        cc.textAlign = 'center';
        cc.fillText(
            `${length} km`, this.canvas.size.width - offset - px_length * 0.5,
            offset + height + 17
        );
    }

    /**
     * @for CanvasController
     * @method canvas_draw_fix
     * @param cc
     * @param name
     */
    canvas_draw_fix(cc, name) {
        cc.fillStyle = this.theme.SCOPE.FIX_FILL;
        cc.globalCompositeOperation = 'source-over';
        cc.lineWidth = 1;

        cc.beginPath();
        cc.moveTo(0, -5);
        cc.lineTo(4, 3);
        cc.lineTo(-4, 3);
        cc.closePath();
        cc.fill();

        cc.fillStyle = this.theme.SCOPE.FIX_TEXT;
        cc.textAlign = 'center';
        cc.textBaseline = 'top';
        cc.fillText(name, 0, 6);
    }

    /**
     * @for CanvasController
     * @method canvas_draw_fixes
     * @param cc
     */
    canvas_draw_fixes(cc) {
        if (!this.canvas.draw_labels) {
            return;
        }

        cc.lineJoin = 'round';
        cc.font = BASE_CANVAS_FONT;

        for (let i = 0; i < this._navigationLibrary.realFixes.length; i++) {
            const fix = this._navigationLibrary.realFixes[i];

            cc.save();
            cc.translate(
                round(UiController.km_to_px(fix.relativePosition[0])) + this.canvas.panX,
                -round(UiController.km_to_px(fix.relativePosition[1])) + this.canvas.panY
            );
            this.canvas_draw_fix(cc, fix.name);
            cc.restore();
        }
    }

    // TODO: break this method up into smaller chunks
    /**
     * @for CanvasController
     * @method canvas_draw_sids
     * @param cc
     */
    canvas_draw_sids(cc) {
        if (!this.canvas.draw_sids) {
            return;
        }

        // Store the count of sid text drawn for a specific transition
        const text_at_point = [];

        cc.strokeStyle = this.theme.SCOPE.SID;
        cc.fillStyle = this.theme.SCOPE.SID;
        cc.setLineDash([1, 10]);
        cc.font = 'italic 14px monoOne, monospace';

        _forEach(this._navigationLibrary.sidLines, (sid) => {
            let write_sid_name = true;
            let fixX = null;
            let fixY = null;

            if (!_has(sid, 'draw')) {
                return;
            }

            _forEach(sid.draw, (fixList, i) => {
                let exit_name = null;

                for (let j = 0; j < fixList.length; j++) {
                    // write exitPoint name
                    if (fixList[j].indexOf('*') !== INVALID_INDEX) {
                        exit_name = fixList[j].replace('*', '');
                        write_sid_name = false;
                    }

                    // TODO: this is duplicated in the if block above. need to consolidate
                    const fixName = fixList[j].replace('*', '');
                    let fix = this._navigationLibrary.getFixRelativePosition(fixName);

                    if (!fix) {
                        log(`Unable to draw line to '${fixList[j]}' because its position is not defined!`, LOG.WARNING);
                    }

                    fixX = UiController.km_to_px(fix[0]) + this.canvas.panX;
                    fixY = -UiController.km_to_px(fix[1]) + this.canvas.panY;

                    if (j === 0) {
                        cc.beginPath();
                        cc.moveTo(fixX, fixY);
                    } else {
                        cc.lineTo(fixX, fixY);
                    }
                }

                cc.stroke();

                if (exit_name) {
                    // Initialize count for this transition
                    if (isNaN(text_at_point[exit_name])) {
                        text_at_point[exit_name] = 0;
                    }

                    // Move the y point for drawing depending on how many sids we have drawn text for
                    // at this point already
                    const y_point = fixY + (15 * text_at_point[exit_name]);
                    cc.fillText(`${sid.identifier}.${exit_name}`, fixX + 10, y_point);

                    text_at_point[exit_name] += 1;  // Increment the count for this transition
                }
            });

            if (write_sid_name) {
                cc.fillText(sid.identifier, fixX + 10, fixY);
            }
        });
    }

    /**
     * Draw a trailing indicator 2.5 NM (4.6km) behind landing aircraft to help with traffic spacing
     *
     * @for CanvasController
     * @method canvas_draw_separation_indicator
     * @param cc
     * @param aircraft
     */
    canvas_draw_separation_indicator(cc, aircraft) {
        if (!GameController.shouldUseTrailingSeparationIndicator(aircraft)) {
            return;
        }

        const runway = aircraft.fms.currentRunway;
        const oppositeOfRunwayHeading = runway.oppositeAngle;

        if (!this.theme.RADAR_TARGET.TRAILING_SEPARATION_INDICATOR_ENABLED) {
            return;
        }

        cc.strokeStyle = this.theme.RADAR_TARGET.TRAILING_SEPARATION_INDICATOR;
        cc.lineWidth = 3;
        cc.translate(
            UiController.km_to_px(aircraft.relativePosition[0]) + this.canvas.panX,
            -UiController.km_to_px(aircraft.relativePosition[1]) + this.canvas.panY
        );
        cc.rotate(oppositeOfRunwayHeading);
        cc.beginPath();
        cc.moveTo(-5, -UiController.km_to_px(5.556));  // 5.556km = 3.0nm
        cc.lineTo(+5, -UiController.km_to_px(5.556));  // 5.556km = 3.0nm
        cc.stroke();
    }

    /**
     * @for CanvasController
     * @method canvas_draw_aircraft_rings
     * @param cc
     * @param aircraft
     */
    canvas_draw_aircraft_rings(cc, aircraft) {
        const aircraftAlerts = aircraft.hasAlerts();

        cc.save();

        if (aircraftAlerts[0]) {
            if (aircraftAlerts[1]) {
                // red violation circle
                cc.strokeStyle = this.theme.RADAR_TARGET.RING_VIOLATION;
            } else {
                // white warning circle
                cc.strokeStyle = this.theme.RADAR_TARGET.RING_CONFLICT;
            }
        } else {
            cc.strokeStyle = cc.fillStyle;
        }

        cc.beginPath();
        cc.arc(0, 0, UiController.km_to_px(km(3)), 0, tau());  // 3nm RADIUS
        cc.stroke();
        cc.restore();
    }

    /**
     * @for CanvasController
     * @method canvas_draw_aircraft
     * @param cc
     * @param aircraft
     */
    canvas_draw_aircraft(cc, aircraft) {
        let match = false;

        if (prop.input.callsign.length > 0 && aircraft.matchCallsign(prop.input.callsign)) {
            match = true;
        }

        if (!aircraft.isVisible()) {
            return;
        }

        // Trailling
        let trailling_length = this.theme.RADAR_TARGET.HISTORY_LENGTH;
        const dpr = window.devicePixelRatio || 1;

        if (dpr > 1) {
            trailling_length *= round(dpr);
        }

        cc.save();

        if (!aircraft.inside_ctr) {
            cc.fillStyle = this.theme.RADAR_TARGET.HISTORY_DOT_OUTSIDE_RANGE;
        } else {
            cc.fillStyle = this.theme.RADAR_TARGET.HISTORY_DOT_INSIDE_RANGE;
        }

        const positionHistory = aircraft.relativePositionHistory;

        for (let i = 0; i < positionHistory.length; i++) {
            const position = aircraft.relativePositionHistory[i];

            cc.beginPath();
            cc.arc(
                UiController.km_to_px(position[0]) + this.canvas.panX,
                UiController.km_to_px(-position[1]) + this.canvas.panY,
                UiController.km_to_px(this.theme.RADAR_TARGET.HISTORY_DOT_RADIUS_KM),
                0,
                tau()
            );
            cc.closePath();
            cc.fill();
        }

        cc.restore();

        if (positionHistory.length > trailling_length) {
            // TODO: This slice is being reassigned to the aircraft, which doesn't really
            // make sense as a canvas controller job. This should be done elsewhere.
            aircraft.relativePositionHistory = positionHistory.slice(
                positionHistory.length - trailling_length,
                positionHistory.length
            );
        }

        if (aircraft.isEstablishedOnCourse()) {
            cc.save();
            this.canvas_draw_separation_indicator(cc, aircraft);
            cc.restore();
        }

        // TODO: if all these parens are actally needed, abstract this out to a function that can return a bool.
        // Aircraft
        // Draw the future path
        if ((GameController.game.option.getOptionByName('drawProjectedPaths') === 'always') ||
          ((GameController.game.option.getOptionByName('drawProjectedPaths') === 'selected') &&
           ((aircraft.warning || match) && !aircraft.isTaxiing()))
        ) {
            this.canvas_draw_future_track(cc, aircraft);
        }

        const alerts = aircraft.hasAlerts();

        cc.translate(
            UiController.km_to_px(aircraft.relativePosition[0]) + this.canvas.panX,
            -UiController.km_to_px(aircraft.relativePosition[1]) + this.canvas.panY
        );

        this.canvas_draw_aircraft_vector_lines(cc, aircraft);

        if (aircraft.notice || alerts[0]) {
            this.canvas_draw_aircraft_rings(cc, aircraft);
        }

        let radarTargetRadiusKm = this.theme.RADAR_TARGET.RADIUS_KM;

        // Draw bigger circle around radar target when the aircraft is selected
        if (match) {
            radarTargetRadiusKm = this.theme.RADAR_TARGET.RADIUS_SELECTED_KM;
        }

        // Draw the radar target (aka aircraft position dot)
        cc.fillStyle = this.theme.RADAR_TARGET.RADAR_TARGET;
        cc.beginPath();
        cc.arc(0, 0, UiController.km_to_px(radarTargetRadiusKm), 0, tau());
        cc.fill();
    }

    /**
     * Draw aircraft vector lines (projected track lines or PTL)
     *
     * Note: These extend in front of aircraft a definable number of minutes
     *
     * @for CanvasController
     * @method canvas_draw_aircraft_vector_lines
     * @param cc {canvas}
     * @param aircraft {AircraftModel}
     */
    canvas_draw_aircraft_vector_lines(cc, aircraft) {
        if (aircraft.hit) {
            return;
        }

        cc.save();

        cc.fillStyle = this.theme.RADAR_TARGET.PROJECTED_TRACK_LINES;
        cc.strokeStyle = this.theme.RADAR_TARGET.PROJECTED_TRACK_LINES;

        const ptlLengthMultiplier = GameController.getPtlLength();
        const lineLengthInHours = ptlLengthMultiplier * TIME.ONE_MINUTE_IN_HOURS;
        const lineLength_km = km(aircraft.groundSpeed * lineLengthInHours);
        const groundTrackVector = vectorize_2d(aircraft.groundTrack);
        const scaledGroundTrackVector = vscale(groundTrackVector, lineLength_km);
        const screenPositionOffsetX = km_to_px(scaledGroundTrackVector[0], UiController.scale);
        const screenPositionOffsetY = km_to_px(scaledGroundTrackVector[1], UiController.scale);

        cc.beginPath();
        cc.moveTo(0, 0);
        cc.lineTo(screenPositionOffsetX, -screenPositionOffsetY);
        cc.stroke();
        cc.restore();
    }

    // TODO: This is currently not working correctly and not in use
    /**
     * Draw dashed line from last coordinate of future track through
     * any later requested fixes.
     *
     * @for CanvasController
     * @method canvas_draw_future_track_fixes
     * @param cc
     * @param aircraft
     * @param future_track
     */
    canvas_draw_future_track_fixes(cc, aircraft, future_track) {
        // const waypointList = aircraft.fms.waypoints;
        //
        // if (waypointList.length <= 1) {
        //     return;
        // }
        // const start = future_track.length - 1;
        // const x = UiController.km_to_px(future_track[start][0]) + this.canvas.panX;
        // const y = -UiController.km_to_px(future_track[start][1]) + this.canvas.panY;
        //
        // cc.beginPath();
        // cc.moveTo(x, y);
        // cc.setLineDash([3, 10]);
        //
        // for (let i = 0; i < waypointList.length; i++) {
        //     const [x, y] = waypointList[i].relativePosition;
        //     const fx = UiController.km_to_px(x) + this.canvas.panX;
        //     const fy = -UiController.km_to_px(y) + this.canvas.panY;
        //
        //     cc.lineTo(fx, fy);
        // }
        //
        // cc.stroke();
    }

    /**
     * Run physics updates into the future, draw future track
     *
     * @for CanvasController
     * @method canvas_draw_future_track
     * @param cc
     * @param aircraft
     */
    canvas_draw_future_track(cc, aircraft) {
        let was_locked = false;
        const future_track = [];
        const save_delta = GameController.game.delta;
        const fms_twin = _cloneDeep(aircraft.fms);
        const twin = _cloneDeep(aircraft);

        twin.fms = fms_twin;
        twin.projected = true;
        GameController.game.delta = 5;

        for (let i = 0; i < 60; i++) {
            twin.update();

            const ils_locked = twin.isEstablishedOnCourse() && twin.fms.currentPhase === FLIGHT_PHASE.APPROACH;

            future_track.push([...twin.relativePosition, ils_locked]);

            if (ils_locked && twin.altitude < 500) {
                break;
            }
        }

        GameController.game.delta = save_delta;
        cc.save();

        // future track colors
        if (aircraft.category === FLIGHT_CATEGORY.DEPARTURE) {
            cc.strokeStyle = this.theme.RADAR_TARGET.PROJECTION_DEPARTURE;
        } else {
            cc.strokeStyle = this.theme.RADAR_TARGET.PROJECTION_ARRIVAL;
        }

        cc.globalCompositeOperation = 'screen';
        cc.lineWidth = 2;
        cc.beginPath();

        for (let i = 0; i < future_track.length; i++) {
            const track = future_track[i];
            const ils_locked = track[2];

            const x = UiController.km_to_px(track[0]) + this.canvas.panX;
            const y = -UiController.km_to_px(track[1]) + this.canvas.panY;

            if (ils_locked && !was_locked) {
                cc.lineTo(x, y);
                // end the current path, start a new path with lockedStroke
                cc.stroke();
                cc.strokeStyle = this.theme.RADAR_TARGET.PROJECTION_ESTABLISHED_ON_APPROACH;
                cc.lineWidth = 3;
                cc.beginPath();
                cc.moveTo(x, y);

                was_locked = true;

                continue;
            }

            if (i === 0) {
                cc.moveTo(x, y);
            } else {
                cc.lineTo(x, y);
            }
        }

        cc.stroke();
        this.canvas_draw_future_track_fixes(cc, twin, future_track);
        cc.restore();
    }

    /**
     * @for CanvasController
     * @method canvas_draw_all_aircraft
     * @param cc
     */
    canvas_draw_all_aircraft(cc) {
        for (let i = 0; i < prop.aircraft.list.length; i++) {
            cc.save();
            this.canvas_draw_aircraft(cc, prop.aircraft.list[i]);
            cc.restore();
        }
    }

    /**
     * Draw an aircraft's data block
     * (box that contains callsign, altitude, speed)
     *
     * @for CanvasController
     * @method anvas_draw_info
     * @param cc
     * @param aircraft
     */
    canvas_draw_info(cc, aircraft) {
        if (!aircraft.isVisible() || aircraft.hit) {
            return;
        }

        // Initial Setup
        cc.save();

        const cs = aircraft.callsign;
        const paddingLR = 5;
        // width of datablock (scales to fit callsign)
        const width = clamp(1, 5.8 * cs.length) + (paddingLR * 2);
        const halfWidth = width / 2;
        // height of datablock
        const height = 31;
        const halfHeight = height / 2;
        // width of colored bar
        const barWidth = 3;
        const barHalfWidth = barWidth / 2;
        const ILS_enabled = aircraft.pilot.hasApproachClearance;
        const lock_size = height / 3;
        const lock_offset = lock_size / 8;
        const pi = Math.PI;
        const point1 = lock_size - barHalfWidth;
        let alt_trend_char = '';
        const a = point1 - lock_offset;
        const b = barHalfWidth;
        const clipping_mask_angle = Math.atan(b / a);
        // describes how far around to arc the arms of the ils lock case
        const pi_slice = pi / 24;
        let match = false;

        // Callsign Matching
        if (prop.input.callsign.length > 0 && aircraft.matchCallsign(prop.input.callsign)) {
            match = true;
        }

        // set color, intensity, and style elements
        let red = this.theme.DATA_BLOCK.ARRIVAL_BAR_OUT_OF_RANGE;
        let green = this.theme.DATA_BLOCK.BACKGROUND_OUT_OF_RANGE;
        let blue = this.theme.DATA_BLOCK.DEPARTURE_BAR_OUT_OF_RANGE;
        let white = this.theme.DATA_BLOCK.TEXT_OUT_OF_RANGE;

        if (aircraft.inside_ctr) {
            red = this.theme.DATA_BLOCK.ARRIVAL_BAR_IN_RANGE;
            green = this.theme.DATA_BLOCK.BACKGROUND_IN_RANGE;
            blue = this.theme.DATA_BLOCK.DEPARTURE_BAR_IN_RANGE;
            white = this.theme.DATA_BLOCK.TEXT_IN_RANGE;

            if (match) {
                red = this.theme.DATA_BLOCK.ARRIVAL_BAR_SELECTED;
                green = this.theme.DATA_BLOCK.BACKGROUND_SELECTED;
                blue = this.theme.DATA_BLOCK.DEPARTURE_BAR_SELECTED;
                white = this.theme.DATA_BLOCK.TEXT_SELECTED;
            }
        }

        cc.textBaseline = 'middle';

        // Move to center of where the data block is to be drawn
        const ac_pos = [
            round(UiController.km_to_px(aircraft.relativePosition[0])) + this.canvas.panX,
            -round(UiController.km_to_px(aircraft.relativePosition[1])) + this.canvas.panY
        ];

        let datablockDir = aircraft.datablockDir;

        if (datablockDir === INVALID_NUMBER) {
            datablockDir = this.theme.DATA_BLOCK.LEADER_DIRECTION;
        }

        const leaderLength = this._calculateLeaderLength();

        // Draw leader line
        let offsetComponent = [
            Math.sin(degreesToRadians(datablockDir)),
            -Math.cos(degreesToRadians(datablockDir))
        ];

        // `degreesToRadians('ctr')` above will yield NaN, so we override that here
        if (datablockDir === 'ctr') {
            offsetComponent = [0, 0];
        }

        const blockPadding = this.theme.DATA_BLOCK.LEADER_PADDING_FROM_BLOCK_PX;
        const targetPadding = this.theme.DATA_BLOCK.LEADER_PADDING_FROM_TARGET_PX;
        const leaderStart = [
            ac_pos[0] + (offsetComponent[0] * targetPadding),
            ac_pos[1] + (offsetComponent[1] * targetPadding)
        ];
        const leaderEnd = [
            ac_pos[0] + offsetComponent[0] * (leaderLength - blockPadding),
            ac_pos[1] + offsetComponent[1] * (leaderLength - blockPadding)
        ];
        const leaderIntersectionWithBlock = [
            ac_pos[0] + offsetComponent[0] * leaderLength,
            ac_pos[1] + offsetComponent[1] * leaderLength
        ];

        cc.moveTo(...leaderStart);
        cc.lineTo(...leaderEnd);
        cc.stroke();

        const blockCenterOffset = {
            ctr: [0, 0],
            360: [0, -halfHeight],
            45: [halfWidth, -halfHeight],
            90: [halfWidth, 0],
            135: [halfWidth, halfHeight],
            180: [0, halfHeight],
            225: [-halfWidth, halfHeight],
            270: [-halfWidth, 0],
            315: [-halfWidth, -halfHeight]
        };
        const leaderEndToBlockCenter = blockCenterOffset[datablockDir];
        const dataBlockCenter = vadd(leaderIntersectionWithBlock, leaderEndToBlockCenter);

        cc.translate(...dataBlockCenter);

        // Draw datablock shapes
        if (!ILS_enabled && this.theme.DATA_BLOCK.HAS_FILL) {
            // data block box background fill
            cc.fillStyle = green;
            cc.fillRect(-halfWidth, -halfHeight, width, height);

            // Draw colored bar
            cc.fillStyle = (aircraft.category === FLIGHT_CATEGORY.DEPARTURE) ? blue : red;
            cc.fillRect(-halfWidth - barWidth, -halfHeight, barWidth, height);
        } else if (this.theme.DATA_BLOCK.HAS_FILL) {
            // Box with ILS Lock Indicator
            cc.save();

            // Draw green part of box (excludes space where ILS Clearance Indicator juts in)
            cc.fillStyle = green;
            cc.beginPath();
            cc.moveTo(-halfWidth, halfHeight);  // bottom-left corner
            cc.lineTo(halfWidth, halfHeight);   // bottom-right corner
            cc.lineTo(halfWidth, -halfHeight);  // top-right corner
            cc.lineTo(-halfWidth, -halfHeight); // top-left corner
            cc.lineTo(-halfWidth, -point1);  // begin side cutout
            cc.arc(-halfWidth - barHalfWidth, -lock_offset, lock_size / 2 + barHalfWidth, clipping_mask_angle - pi / 2, 0);
            cc.lineTo(-halfWidth + lock_size / 2, lock_offset);
            cc.arc(-halfWidth - barHalfWidth, lock_offset, lock_size / 2 + barHalfWidth, 0, pi / 2 - clipping_mask_angle);
            cc.closePath();
            cc.fill();

            // Draw ILS Clearance Indicator
            cc.translate(-halfWidth - barHalfWidth, 0);
            cc.lineWidth = barWidth;
            cc.strokeStyle = red;
            cc.beginPath(); // top arc start
            cc.arc(0, -lock_offset, lock_size / 2, -pi_slice, pi + pi_slice, true);
            cc.moveTo(0, -lock_size / 2);
            cc.lineTo(0, -halfHeight);
            cc.stroke(); // top arc end
            cc.beginPath(); // bottom arc start
            cc.arc(0, lock_offset, lock_size / 2, pi_slice, pi - pi_slice);
            cc.moveTo(0, lock_size - barWidth);
            cc.lineTo(0, halfHeight);
            cc.stroke();  // bottom arc end

            if (aircraft.isEstablishedOnCourse()) {
                // Localizer Capture Indicator
                cc.fillStyle = white;
                cc.beginPath();
                cc.arc(0, 0, lock_size / 5, 0, pi * 2);
                cc.fill(); // Draw Localizer Capture Dot
            }

            cc.translate(halfWidth + barHalfWidth, 0);
            // unclear how this works...
            cc.beginPath(); // if removed, white lines appear on top of bottom half of lock case
            cc.stroke(); // if removed, white lines appear on top of bottom half of lock case

            cc.restore();
        }

        // Text
        const gap = 3;          // height of TOTAL vertical space between the rows (0 for touching)
        const lineheight = 4.5; // height of text row (used for spacing basis)
        const row1text = cs;
        const aircraftAltitude = round(aircraft.altitude * 0.01);
        const aircraftSpeed = round(aircraft.groundSpeed * 0.1);
        const row2text = `${leftPad(aircraftAltitude, 3)} ${leftPad(aircraftSpeed, 2)}`;

        // TODO: remove the if/else in favor of an initial assignment, and update with if condition
        if (aircraft.inside_ctr) {
            cc.fillStyle = this.theme.DATA_BLOCK.TEXT_IN_RANGE;
        } else {
            cc.fillStyle = this.theme.DATA_BLOCK.TEXT_OUT_OF_RANGE;
        }

        // Draw full datablock text
        cc.font = this.theme.DATA_BLOCK.TEXT_FONT;
        cc.textAlign = 'left';
        cc.fillText(row1text, -halfWidth + paddingLR, -gap / 2 - lineheight);
        cc.fillText(row2text, -halfWidth + paddingLR, gap / 2 + lineheight);
        cc.font = BASE_CANVAS_FONT;  // change back to normal font

        cc.restore();
    }

    /**
     * @for CanvasController
     * @method canvas_draw_all_info
     * @param cc
     */
    canvas_draw_all_info(cc) {
        for (let i = 0; i < prop.aircraft.list.length; i++) {
            cc.save();
            this.canvas_draw_info(cc, prop.aircraft.list[i]);
            cc.restore();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_compass
     * @param cc
     */
    canvas_draw_compass(cc) {
        cc.translate(
            calculateMiddle(this.canvas.size.width),
            calculateMiddle(this.canvas.size.height)
        );

        const airport = AirportController.airport_get();
        const size = 80;
        const size2 = size / 2;
        const padding = 16;
        const dot = 16;
        let windspeed_line;
        let highwind;

        // Shift compass location
        cc.translate(-size2 - padding, -size2 - padding);
        cc.lineWidth = 4;

        // Outer circle
        cc.fillStyle = this.theme.WIND_VANE.OUTER_RING_FILL;
        cc.beginPath();
        cc.arc(0, 0, size2, 0, tau());
        cc.fill();

        // Inner circle
        cc.lineWidth = 1;
        cc.beginPath();
        cc.arc(0, 0, dot / 2, 0, tau());
        cc.strokeStyle = this.theme.WIND_VANE.INNER_RING_STROKE;
        cc.stroke();

        // Wind Value
        cc.fillStyle = this.theme.WIND_VANE.WIND_SPEED_TEXT;
        cc.textAlign = 'center';
        cc.textBaseline = 'center';
        cc.font = '9px monoOne, monospace';
        cc.fillText(airport.wind.speed, 0, 3.8);
        cc.font = 'bold 10px monoOne, monospace';

        // Wind line
        if (airport.wind.speed > 8) {
            windspeed_line = airport.wind.speed / 2;
            highwind = true;
        } else {
            windspeed_line = airport.wind.speed;
            highwind = false;
        }

        cc.save();
        cc.translate(
            -dot / 2 * sin(airport.wind.angle),
            dot / 2 * cos(airport.wind.angle)
        );
        cc.beginPath();
        cc.moveTo(0, 0);
        cc.rotate(airport.wind.angle);
        cc.lineTo(0, extrapolate_range_clamp(0, windspeed_line, 15, 0, size2 - dot));

        // TODO: simplify. replace with initial assignment and re-assignment in if condition
        // Color wind line red for high-wind
        if (highwind) {
            cc.strokeStyle = this.theme.WIND_VANE.DIRECTION_LINE_GUSTY;
        } else {
            cc.strokeStyle = this.theme.WIND_VANE.DIRECTION_LINE;
        }

        cc.lineWidth = 2;
        cc.stroke();
        cc.restore();
        cc.fillStyle = this.theme.WIND_VANE.WIND_SPEED_TEXT;
        cc.textAlign = 'center';
        cc.textBaseline = 'top';

        for (let i = 90; i <= 360; i += 90) {
            cc.rotate(degreesToRadians(90));

            let angle;
            if (i === 90) {
                angle = `0${i}`;
            } else {
                angle = i;
            }

            cc.save();
            cc.fillText(angle, 0, -size2 + 4);
            cc.restore();
        }
    }

    /**
     * Draw circular airspace border
     *
     * @for CanvasController
     * @method anvas_draw_ctr
     * @param cc
     */
    canvas_draw_ctr(cc) {
        cc.strokeStyle = this.theme.SCOPE.AIRSPACE_PERIMETER;
        cc.fillStyle = this.theme.SCOPE.AIRSPACE_FILL;

        cc.beginPath();
        cc.arc(0, 0, AirportController.airport_get().ctr_radius * UiController.scale, 0, tau());
        cc.fill();
        cc.stroke();
    }

    /**
     * Draw polygonal airspace border
     *
     * @for CanvasController
     * @method anvas_draw_airspace_border
     * @param cc
     */
    canvas_draw_airspace_border(cc) {
        const airport = AirportController.airport_get();

        if (!airport.airspace) {
            this.canvas_draw_ctr(cc);
        }

        // style
        cc.strokeStyle = this.theme.SCOPE.AIRSPACE_PERIMETER;
        cc.fillStyle = this.theme.SCOPE.AIRSPACE_FILL;

        // draw airspace
        for (let i = 0; i < airport.airspace.length; i++) {
            const poly = $.map(airport.perimeter.poly, (v) => {
                return [v.relativePosition];
            });

            this.canvas_draw_poly(cc, poly);
            cc.clip();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_fancy_rings
     * @param cc
     * @param fix_origin
     * @param fix1
     * @param fix2
     */
    canvas_draw_fancy_rings(cc, fix_origin, fix1, fix2) {
        const airport = AirportController.airport_get();
        const origin = airport.getFixPosition(fix_origin);
        const f1 = airport.getFixPosition(fix1);
        const f2 = airport.getFixPosition(fix2);
        const minDist = Math.min(distance2d(origin, f1), distance2d(origin, f2));
        const halfPI = Math.PI / 2;
        const extend_ring = degreesToRadians(10);
        const start_angle = Math.atan2(f1[0] - origin[0], f1[1] - origin[1]) - halfPI - extend_ring;
        const end_angle = Math.atan2(f2[0] - origin[0], f2[1] - origin[1]) - halfPI + extend_ring;
        const x = round(UiController.km_to_px(origin[0])) + this.canvas.panX;
        const y = -round(UiController.km_to_px(origin[1])) + this.canvas.panY;
        // 5NM = 9.27km
        const radius = 9.27;

        for (let i = 0; i < 4; i++) {
            cc.beginPath();
            cc.arc(
                x,
                y,
                UiController.km_to_px(minDist - (i * radius)),
                start_angle, end_angle
            );

            cc.stroke();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_engm_range_rings
     * @param cc
     */
    // Draw range rings for ENGM airport to assist in point merge
    canvas_draw_engm_range_rings(cc) {
        cc.strokeStyle = this.theme.SCOPE.RANGE_RING_COLOR;
        cc.setLineDash([3, 6]);

        this.canvas_draw_fancy_rings(cc, 'BAVAD', 'GM428', 'GM432');
        this.canvas_draw_fancy_rings(cc, 'TITLA', 'GM418', 'GM422');
        this.canvas_draw_fancy_rings(cc, 'INSUV', 'GM403', 'GM416');
        this.canvas_draw_fancy_rings(cc, 'VALPU', 'GM410', 'GM402');
    }

    /**
     * @for CanvasController
     * @method canvas_draw_range_rings
     * @param cc
     */
    canvas_draw_range_rings(cc) {
        const airport = AirportController.airport_get();
        // convert input param from nm to km
        const rangeRingRadius = km(airport.rr_radius_nm);

        // Fill up airport's ctr_radius with rings of the specified radius
        for (let i = 1; i * rangeRingRadius < airport.ctr_radius; i++) {
            cc.beginPath();
            cc.linewidth = 1;
            cc.arc(0, 0, rangeRingRadius * UiController.scale * i, 0, tau());
            cc.strokeStyle = this.theme.SCOPE.RANGE_RING_COLOR;
            cc.stroke();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_poly
     * @param cc
     * @param poly
     */
    canvas_draw_poly(cc, poly) {
        cc.beginPath();

        _forEach(poly, (singlePoly, v) => {
            cc.lineTo(
                UiController.km_to_px(singlePoly[0]),
                -UiController.km_to_px(singlePoly[1])
            );
        });

        cc.closePath();
        cc.stroke();
        cc.fill();
    }

    /**
     * @for CanvasController
     * @method canvas_draw_terrain
     * @param cc
     */
    canvas_draw_terrain(cc) {
        if (!this.canvas.draw_terrain) {
            return;
        }

        // Terrain key rectangles' outline stroke color
        // Also determines color of terrain outline drawn at '0ft'
        cc.strokeStyle = this.theme.SCOPE.FIX_FILL;
        // Somehow used to tint the terrain key rectangles' fill color
        // Also determines color of terrain fill at '0ft'
        cc.fillStyle = this.theme.SCOPE.FIX_FILL;
        cc.lineWidth = clamp(0.5, (UiController.scale / 10), 2);
        cc.lineJoin = 'round';

        const airport = AirportController.airport_get();
        let max_elevation = 0;

        cc.save();
        cc.translate(this.canvas.panX, this.canvas.panY);

        // TODO: Remove the jQuery in favor of _each()!
        $.each(airport.terrain || [], (elevation, terrainLevel) => {
            if (elevation < 1000) {
                console.warn(`${airport.icao}.geojson contains 'terrain' at or` +
                    ' below sea level, which is not supported!');

                // within `$.each()`, this return acts like `continue;`
                return;
            }

            max_elevation = Math.max(max_elevation, elevation);
            // Here we use HSL colors instead of RGB to enable easier bulk adjustments
            // to saturation/lightness of multiple elevation levels without the need
            // to use web-based color tools
            const color = `hsla(${this.theme.TERRAIN.COLOR[elevation]}`;

            cc.strokeStyle = `${color}, ${this.theme.TERRAIN.BORDER_OPACITY})`;
            cc.fillStyle = `${color}, ${this.theme.TERRAIN.FILL_OPACITY})`;

            _forEach(terrainLevel, (terrainGroup) => {
                cc.beginPath();

                _forEach(terrainGroup, (terrainItem) => {
                    // TODO: should this be a for/in? is it an array?
                    _forEach(terrainItem, (value, index) => {
                        // Loose equals is important here.
                        if (index === 0) {
                            cc.moveTo(
                                UiController.km_to_px(terrainItem[index][0]),
                                -UiController.km_to_px(terrainItem[index][1])
                            );
                        }

                        cc.lineTo(
                            UiController.km_to_px(terrainItem[index][0]),
                            -UiController.km_to_px(terrainItem[index][1])
                        );
                    });

                    cc.closePath();
                });

                cc.fill();
                cc.stroke();
            });
        });

        cc.restore();

        if (max_elevation === 0) {
            return;
        }

        const offset = 10;
        const width = this.canvas.size.width;
        const height = this.canvas.size.height;
        const box_width = 30;
        const box_height = 5;

        cc.font = BASE_CANVAS_FONT;
        cc.lineWidth = 1;

        for (let i = 1000; i <= max_elevation; i += 1000) {
            cc.save();
            // translate coordinates for every block to not use these X & Y twice in rect and text
            // .5 in X and Y coordinates are used to make 1px rectangle fit exactly into 1 px
            // and not be blurred
            cc.translate(
                width / 2 - 140.5 - (max_elevation - i) / 1000 * (box_width + 1),
                -height / 2 + offset + 0.5
            );
            cc.beginPath();
            cc.rect(0, 0, box_width - 1, box_height);
            cc.closePath();

            // in the map, terrain of higher levels has fill of all the lower levels
            // so we need to fill it below exactly as in the map
            for (let j = 0; j <= i; j += 1000) {
                cc.fillStyle = `rgba(${this.theme.TERRAIN.COLOR[j]}, ${this.theme.TERRAIN.FILL_OPACITY})`;
                cc.fill();
            }

            cc.strokeStyle = `rgba(${this.theme.TERRAIN.COLOR[i]}, ${this.theme.TERRAIN.BORDER_OPACITY})`;
            cc.stroke();

            // write elevation signs only for the outer elevations
            if (i === max_elevation || i === 1000) {
                cc.fillStyle = this.theme.SCOPE.COMPASS_TEXT;
                cc.textAlign = 'center';
                cc.textBaseline = 'top';
                cc.fillText(`${i}'`, box_width / 2 + 0.5, offset + 2);
            }

            cc.restore();
        }
    }

    /**
     * @for CanvasController
     * @method canvas_draw_restricted
     * @param cc
     */
    canvas_draw_restricted(cc) {
        if (!this.canvas.draw_restricted) {
            return;
        }

        cc.strokeStyle = this.theme.SCOPE.RESTRICTED_AIRSPACE;
        cc.lineWidth = Math.max(UiController.scale / 3, 2);
        cc.lineJoin = 'round';
        cc.font = BASE_CANVAS_FONT;

        const airport = AirportController.airport_get();

        cc.save();
        cc.translate(this.canvas.panX, this.canvas.panY);

        _forEach(airport.restricted_areas, (area) => {
            cc.fillStyle = 'transparent';
            this.canvas_draw_poly(cc, area.coordinates);

            // FIXME: Is the restricted airspace EVER filled???
            cc.fillStyle = this.theme.SCOPE.RESTRICTED_AIRSPACE;
            cc.textAlign = 'center';
            cc.textBaseline = 'top';

            const height = (area.height === Infinity ? 'UNL' : 'FL' + Math.ceil(area.height / 1000) * 10);
            let height_shift = 0;

            if (area.name) {
                height_shift = -12;

                cc.fillText(
                    area.name,
                    round(UiController.km_to_px(area.center[0])),
                    -round(UiController.km_to_px(area.center[1]))
                );
            }

            cc.fillText(
                height,
                round(UiController.km_to_px(area.center[0])),
                height_shift - round(UiController.km_to_px(area.center[1]))
            );
        });

        cc.restore();
    }

    /**
     * @for CanvasController
     * @method canvas_draw_videoMap
     * @param cc
     */
    canvas_draw_videoMap(cc) {
        if (!_has(AirportController.airport_get(), 'maps')) {
            return;
        }

        cc.strokeStyle = this.theme.SCOPE.VIDEO_MAP;
        cc.lineWidth = UiController.scale / 15;
        cc.lineJoin = 'round';
        cc.font = BASE_CANVAS_FONT;

        const airport = AirportController.airport_get();
        const map = airport.maps.base;

        cc.save();
        cc.translate(this.canvas.panX, this.canvas.panY);

        _forEach(map, (mapItem, i) => {
            cc.moveTo(UiController.km_to_px(mapItem[0]), -UiController.km_to_px(mapItem[1]));
            // cc.beginPath();
            cc.lineTo(UiController.km_to_px(mapItem[2]), -UiController.km_to_px(mapItem[3]));
        });

        cc.stroke();
        cc.restore();
    }

    /** Draws crosshairs that point to the currently translated location

    /**
     * @for CanvasController
     * @method canvas_draw_crosshairs
     * @param cc
     */
    canvas_draw_crosshairs(cc) {
        cc.save();
        cc.strokeStyle = this.theme.SCOPE.CROSSHAIR_STROKE;
        cc.lineWidth = 3;
        cc.beginPath();
        cc.moveTo(-10, 0);
        cc.lineTo(10, 0);
        cc.stroke();
        cc.beginPath();
        cc.moveTo(0, -10);
        cc.lineTo(0, 10);
        cc.stroke();
        cc.restore();
    }

    /**
     * Draw the compass around the scope edge
     *
     * @for CanvasController
     * @method canvas_draw_directions
     * @param cc
     */
    canvas_draw_directions(cc) {
        if (GameController.game_paused()) {
            return;
        }

        const callsign = prop.input.callsign.toUpperCase();

        if (callsign.length === 0) {
            return;
        }

        // Get the selected aircraft.
        const aircraft = _filter(prop.aircraft.list, (p) => {
            return p.matchCallsign(callsign) && p.isVisible();
        })[0];

        if (!aircraft) {
            return;
        }

        const pos = this.to_canvas_pos(aircraft.relativePosition);
        const rectPos = [0, 0];
        const rectSize = [this.canvas.size.width, this.canvas.size.height];

        cc.save();
        cc.strokeStyle = this.theme.SCOPE.COMPASS_HASH;
        cc.fillStyle = this.theme.SCOPE.COMPASS_TEXT;
        cc.textAlign = 'center';
        cc.textBaseline = 'middle';

        for (let alpha = 0; alpha < 360; alpha++) {
            const dir = [
                sin(degreesToRadians(alpha)),
                -cos(degreesToRadians(alpha))
            ];

            const p = positive_intersection_with_rect(pos, dir, rectPos, rectSize);

            if (p) {
                const markLen = (alpha % 5 === 0 ?
                    (alpha % 10 === 0
                        ? 16
                        : 12)
                    : 8
                );
                const markWeight = (alpha % 30 === 0
                    ? 2
                    : 1
                );

                const dx = -markLen * dir[0];
                const dy = -markLen * dir[1];

                cc.lineWidth = markWeight;
                cc.beginPath();
                cc.moveTo(p[0], p[1]);

                const markX = p[0] + dx;
                const markY = p[1] + dy;

                cc.lineTo(markX, markY);
                cc.stroke();

                if (alpha % 10 === 0) {
                    cc.font = (alpha % 30 === 0
                        ? 'bold 10px monoOne, monospace'
                        : BASE_CANVAS_FONT);

                    const text = '' + alpha;
                    const textWidth = cc.measureText(text).width;

                    cc.fillText(
                        text,
                        markX - dir[0] * (textWidth / 2 + 4),
                        markY - dir[1] * 7);
                }
            }
        }

        cc.restore();
    }

    /**
     * @for CanvasController
     * @method to_canvas_
     * @param pos {}
     */
    to_canvas_pos(pos) {
        return [
            this.canvas.size.width / 2 + this.canvas.panX + km(pos[0]),
            this.canvas.size.height / 2 + this.canvas.panY - km(pos[1])
        ];
    }

    /**
     * Calculate the length of the leader line connecting the target to the data block
     *
     * @for CanvasController
     * @method _calculateLeaderLength
     * @return {number} length, in pixels
     */
    _calculateLeaderLength() {
        return this.theme.DATA_BLOCK.LEADER_LENGTH *
            this.theme.DATA_BLOCK.LEADER_LENGTH_INCREMENT_PIXELS +
            this.theme.DATA_BLOCK.LEADER_LENGTH_ADJUSTMENT_PIXELS -
            this.theme.DATA_BLOCK.LEADER_PADDING_FROM_BLOCK_PX -
            this.theme.DATA_BLOCK.LEADER_PADDING_FROM_TARGET_PX;
    }

    /**
     * Center a point in the view
     *
     * Used only for centering aircraft, this accepts
     * the x,y of an aircrafts relativePosition
     *
     * @for CanvasController
     * @method _onCenterPointInView
     * @param x {number}    relativePosition.x
     * @param y {number}    relativePosition.y
     */
    _onCenterPointInView = ({ x, y }) => {
        this.canvas.panX = 0 - round(UiController.km_to_px(x));
        this.canvas.panY = round(UiController.km_to_px(y));
        this.dirty = true;
    };

    /**
     * Change theme to the specified name
     *
     * This should ONLY be called through the EventBus during a `SET_THEME` event,
     * thus ensuring that the same theme is always in use by all app components.
     *
     * This method must remain an arrow function in order to preserve the scope
     * of `this`, since it is being invoked by an EventBus callback.
     *
     * @for CanvasController
     * @method _setTheme
     * @param themeName {string}
     */
    _setTheme = (themeName) => {
        if (!_has(THEME, themeName)) {
            console.error(`Expected valid theme to change to, but received '${themeName}'`);

            return;
        }

        this.theme = THEME[themeName];
    };
}
