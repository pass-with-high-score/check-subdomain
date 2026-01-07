/**
 * ANeko Simulation Engine
 * Ported from Android's AnimationService.MotionState
 * 
 * Physics-based animation simulation with:
 * - Acceleration-based movement toward target
 * - 8-direction detection for move states
 * - Wall collision detection
 * - Behaviour modes: Closer, Further, Whimsical
 */

import { SkinData, MotionParams, AnimationItem } from '@/lib/types/skin';

export type MoveDirection = 'right' | 'downRight' | 'down' | 'downLeft' | 'left' | 'upLeft' | 'up' | 'upRight';
export type WallDirection = 'up' | 'down' | 'left' | 'right';
export type Behaviour = 'closer' | 'further' | 'whimsical';

export interface SimulationState {
    curX: number;
    curY: number;
    targetX: number;
    targetY: number;
    vx: number;
    vy: number;
    currentState: string;
    movingState: boolean;
    stateChanged: boolean;
    positionMoved: boolean;
    frameIndex: number;
}

export interface SimulatorConfig {
    displayWidth: number;
    displayHeight: number;
    spriteSize: number;
    speedFactor: number;
    behaviour: Behaviour;
}

const ANIMATION_INTERVAL = 125; // ms
const DIRECTION_MAP: MoveDirection[] = ['right', 'downRight', 'down', 'downLeft', 'left', 'upLeft', 'up', 'upRight'];

export class SimulationEngine {
    private state: SimulationState;
    private config: SimulatorConfig;
    private params: MotionParams;
    private skinData: SkinData;
    private random: () => number = Math.random;

    constructor(skinData: SkinData, config: SimulatorConfig) {
        this.skinData = skinData;
        this.params = skinData.params;
        this.config = config;

        this.state = {
            curX: config.displayWidth / 2,
            curY: config.displayHeight / 2,
            targetX: config.displayWidth / 2,
            targetY: config.displayHeight / 2,
            vx: 0,
            vy: 0,
            currentState: this.params.initialState,
            movingState: false,
            stateChanged: true,
            positionMoved: false,
            frameIndex: 0,
        };
    }

    getState(): SimulationState {
        return { ...this.state };
    }

    setConfig(config: Partial<SimulatorConfig>) {
        this.config = { ...this.config, ...config };
    }

    setTargetPosition(x: number, y: number) {
        const { displayWidth, displayHeight } = this.config;

        switch (this.config.behaviour) {
            case 'closer':
                this.setTargetDirect(x, y);
                break;

            case 'further': {
                let dx = displayWidth / 2 - x;
                let dy = displayHeight / 2 - y;
                if (dx === 0 && dy === 0) {
                    const ang = this.random() * Math.PI * 2;
                    dx = Math.cos(ang);
                    dy = Math.sin(ang);
                }
                if (dx < 0) { dx = -dx; dy = -dy; }

                let ex: number, ey: number;
                if (Math.abs(dy) > Math.abs(dx * displayHeight / displayWidth)) {
                    const dxdy = dx / dy;
                    if (dy > 0) {
                        ex = (displayWidth - displayHeight * dxdy) / 2;
                        ey = 0;
                    } else {
                        ex = (displayWidth + displayHeight * dxdy) / 2;
                        ey = displayHeight;
                    }
                } else {
                    const dydx = dy / dx;
                    ex = displayWidth;
                    ey = (displayHeight + displayWidth * dydx) / 2;
                }

                const r = 0.9 + this.random() * 0.1;
                this.setTargetDirect(ex * r + x * (1 - r), ey * r + y * (1 - r));
                break;
            }

            case 'whimsical': {
                const minWH2 = Math.min(displayWidth, displayHeight) / 2;
                const radius = this.random() * minWH2 + minWH2;
                const angle = this.random() * 360;
                let nx = this.state.curX + radius * Math.cos(angle * Math.PI / 180);
                let ny = this.state.curY + radius * Math.sin(angle * Math.PI / 180);

                // Random edge positions
                if (this.random() < 0.15) nx = this.random() < 0.5 ? 0 : displayWidth;
                if (this.random() < 0.15) ny = this.random() < 0.5 ? 0 : displayHeight;

                // Bounce off edges
                if (nx < 0) nx = -nx;
                else if (nx >= displayWidth) nx = displayWidth * 2 - nx - 1;
                if (ny < 0) ny = -ny;
                else if (ny >= displayHeight) ny = displayHeight * 2 - ny - 1;

                nx = Math.max(0, Math.min(displayWidth, nx));
                ny = Math.max(0, Math.min(displayHeight, ny));

                this.setTargetDirect(nx, ny);
                break;
            }
        }
    }

    private setTargetDirect(x: number, y: number) {
        this.state.targetX = x;
        this.state.targetY = y;
    }

    reset() {
        this.state = {
            curX: this.config.displayWidth / 2,
            curY: this.config.displayHeight / 2,
            targetX: this.config.displayWidth / 2,
            targetY: this.config.displayHeight / 2,
            vx: 0,
            vy: 0,
            currentState: this.params.initialState,
            movingState: false,
            stateChanged: true,
            positionMoved: false,
            frameIndex: 0,
        };
    }

    /**
     * Main update loop - call this every ANIMATION_INTERVAL ms
     */
    update(): void {
        this.state.stateChanged = false;
        this.state.positionMoved = false;

        const dx = this.state.targetX - this.state.curX;
        const dy = this.state.targetY - this.state.curY;
        const len = Math.hypot(dx, dy);

        // Check if we're close enough to target
        if (len <= this.params.proximityDistance) {
            if (this.state.movingState) {
                this.state.vx = 0;
                this.state.vy = 0;
                this.changeState(this.params.initialState);
            }
            return;
        }

        // If not moving, wake up
        if (!this.state.movingState) {
            const awakeState = this.params.awakeState;
            if (this.hasState(awakeState)) {
                this.changeState(awakeState);
            }
            return;
        }

        // Physics update
        const interval = ANIMATION_INTERVAL / 1000;
        const acc = this.params.acceleration * this.config.speedFactor;
        const maxV = this.params.maxVelocity * this.config.speedFactor;
        const decelDist = this.params.deaccelerationDistance;

        if (len > 0) {
            this.state.vx += acc * interval * dx / len;
            this.state.vy += acc * interval * dy / len;
        }

        const curSpeed = Math.hypot(this.state.vx, this.state.vy);
        const dynMax = maxV * Math.min((len + 1) / (decelDist + 1), 1);

        if (curSpeed > dynMax) {
            if (dynMax <= 0 && curSpeed > 0) {
                this.state.vx = 0;
                this.state.vy = 0;
            } else if (curSpeed > 0) {
                const ratio = dynMax / curSpeed;
                this.state.vx *= ratio;
                this.state.vy *= ratio;
            }
        }

        this.state.curX += this.state.vx * interval;
        this.state.curY += this.state.vy * interval;
        this.state.positionMoved = true;

        this.changeToMovingState();
    }

    /**
     * Check wall collision and change to wall state if needed
     * Wall detection happens when sprite reaches screen edges during movement
     */
    checkWall(): boolean {
        // Only check walls when moving or in a state that requires wall check
        if (!this.state.movingState && !this.needCheckWall(this.state.currentState)) {
            return false;
        }

        const spriteHalf = this.config.spriteSize / 2;
        const { curX, curY } = this.state;
        const { displayWidth, displayHeight } = this.config;

        let dir: WallDirection | null = null;

        // Check if sprite is touching edges
        if (curX <= spriteHalf) {
            dir = 'left';
            this.state.curX = spriteHalf; // Clamp to edge
        } else if (curX >= displayWidth - spriteHalf) {
            dir = 'right';
            this.state.curX = displayWidth - spriteHalf;
        } else if (curY <= spriteHalf) {
            dir = 'up';
            this.state.curY = spriteHalf;
        } else if (curY >= displayHeight - spriteHalf) {
            dir = 'down';
            this.state.curY = displayHeight - spriteHalf;
        }

        if (!dir) return false;

        const wallState = this.getWallState(dir);
        if (!this.hasState(wallState)) return false;

        // Stop movement when hitting wall
        this.state.vx = 0;
        this.state.vy = 0;
        this.state.targetX = this.state.curX;
        this.state.targetY = this.state.curY;

        this.changeState(wallState);
        return true;
    }

    /**
     * Check if we need to update to moving state
     */
    updateMovingState(): boolean {
        if (!this.needCheckMove(this.state.currentState)) return false;

        const len = Math.hypot(
            this.state.targetX - this.state.curX,
            this.state.targetY - this.state.curY
        );
        if (len <= this.params.proximityDistance) return false;

        this.changeToMovingState();
        return true;
    }

    /**
     * Change to next state (for animation end)
     */
    changeToNextState(): boolean {
        const nextState = this.getNextState(this.state.currentState);
        if (!nextState) return false;
        this.changeState(nextState);
        return true;
    }

    /**
     * Process full update cycle
     */
    tick(): void {
        this.update();
        // Check wall first (has priority), then moving state, then nextState
        if (this.checkWall()) {
            // Wall state triggered, stop here
            return;
        }
        if (this.updateMovingState() || this.changeToNextState()) {
            // State changed
        }
    }

    private changeState(state: string) {
        if (state === this.state.currentState) return;
        this.state.currentState = state;
        this.state.stateChanged = true;
        this.state.movingState = false;
        this.state.frameIndex = 0;
    }

    private changeToMovingState() {
        const { vx, vy } = this.state;
        const dirIdx = Math.floor(((Math.atan2(vy, vx) * 4 / Math.PI) + 8.5)) % 8;
        const moveDir = DIRECTION_MAP[dirIdx];
        const moveState = this.getMoveState(moveDir);

        if (!this.hasState(moveState)) return;

        if (moveState !== this.state.currentState) {
            this.state.currentState = moveState;
            this.state.stateChanged = true;
            this.state.frameIndex = 0;
        }
        this.state.movingState = true;
    }

    // Helper methods for state lookup
    private hasState(state: string): boolean {
        return this.skinData.states.some(s => s.state === state);
    }

    private getMoveState(dir: MoveDirection): string {
        const prefix = this.params.moveStatePrefix;
        const dirMap: Record<MoveDirection, string> = {
            'up': 'Up',
            'down': 'Down',
            'left': 'Left',
            'right': 'Right',
            'upLeft': 'UpLeft',
            'upRight': 'UpRight',
            'downLeft': 'DownLeft',
            'downRight': 'DownRight',
        };
        return prefix + dirMap[dir];
    }

    private getWallState(dir: WallDirection): string {
        const prefix = this.params.wallStatePrefix;
        const dirMap: Record<WallDirection, string> = {
            'up': 'Up',
            'down': 'Down',
            'left': 'Left',
            'right': 'Right',
        };
        return prefix + dirMap[dir];
    }

    private needCheckWall(state: string): boolean {
        const stateData = this.skinData.states.find(s => s.state === state);
        return stateData?.checkWall ?? false;
    }

    private needCheckMove(state: string): boolean {
        const stateData = this.skinData.states.find(s => s.state === state);
        return stateData?.checkMove ?? false;
    }

    private getNextState(state: string): string | undefined {
        const stateData = this.skinData.states.find(s => s.state === state);
        return stateData?.nextState;
    }

    /**
     * Get current frame drawable name
     */
    getCurrentDrawable(): string | null {
        const stateData = this.skinData.states.find(s => s.state === this.state.currentState);
        if (!stateData) return null;

        const frames = this.flattenFrames(stateData.items);
        if (frames.length === 0) return null;

        const frameIdx = this.state.frameIndex % frames.length;
        return frames[frameIdx]?.drawable ?? null;
    }

    /**
     * Get current frame duration
     */
    getCurrentDuration(): number {
        const stateData = this.skinData.states.find(s => s.state === this.state.currentState);
        if (!stateData) return 250;

        const frames = this.flattenFrames(stateData.items);
        if (frames.length === 0) return 250;

        const frameIdx = this.state.frameIndex % frames.length;
        return frames[frameIdx]?.duration ?? 250;
    }

    /**
     * Advance to next frame
     */
    nextFrame(): void {
        const stateData = this.skinData.states.find(s => s.state === this.state.currentState);
        if (!stateData) return;

        const frames = this.flattenFrames(stateData.items);
        if (frames.length === 0) return;

        this.state.frameIndex = (this.state.frameIndex + 1) % frames.length;

        // If we wrapped, the animation ended
        if (this.state.frameIndex === 0) {
            this.changeToNextState();
        }
    }

    private flattenFrames(items: AnimationItem[]): { drawable: string; duration: number }[] {
        const frames: { drawable: string; duration: number }[] = [];

        const processItems = (itemList: AnimationItem[], repeatCount = 1) => {
            for (let r = 0; r < repeatCount; r++) {
                for (const item of itemList) {
                    if (item.type === 'item' && item.drawable) {
                        frames.push({ drawable: item.drawable, duration: item.duration || 250 });
                    } else if (item.type === 'repeat-item' && item.items) {
                        processItems(item.items, item.repeatCount || 1);
                    }
                }
            }
        };

        processItems(items);
        return frames;
    }

    getAnimationInterval(): number {
        return ANIMATION_INTERVAL;
    }
}
