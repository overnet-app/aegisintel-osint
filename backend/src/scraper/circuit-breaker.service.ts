import { Injectable, Logger } from '@nestjs/common';

enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN',
}

interface CircuitStats {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    nextAttemptTime: number | null;
}

@Injectable()
export class CircuitBreakerService {
    private readonly logger = new Logger(CircuitBreakerService.name);
    private readonly circuits: Map<string, CircuitStats> = new Map();
    private readonly failureThreshold = 5;
    private readonly timeout = 60000; // 1 minute
    private readonly halfOpenMaxAttempts = 3;

    async execute<T>(platform: string, fn: () => Promise<T>): Promise<T> {
        const circuit = this.getCircuit(platform);
        const now = Date.now();

        // Check if circuit should transition from OPEN to HALF_OPEN
        if (circuit.state === CircuitState.OPEN) {
            if (circuit.nextAttemptTime && now >= circuit.nextAttemptTime) {
                circuit.state = CircuitState.HALF_OPEN;
                circuit.successes = 0;
                this.logger.log(`Circuit breaker for ${platform} moved to HALF_OPEN`);
            } else {
                throw new Error(`Circuit breaker is OPEN for ${platform}. Please retry later.`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess(platform, circuit);
            return result;
        } catch (error) {
            this.onFailure(platform, circuit, now);
            throw error;
        }
    }

    private getCircuit(platform: string): CircuitStats {
        if (!this.circuits.has(platform)) {
            this.circuits.set(platform, {
                state: CircuitState.CLOSED,
                failures: 0,
                successes: 0,
                lastFailureTime: null,
                nextAttemptTime: null,
            });
        }
        return this.circuits.get(platform)!;
    }

    private onSuccess(platform: string, circuit: CircuitStats) {
        if (circuit.state === CircuitState.HALF_OPEN) {
            circuit.successes++;
            if (circuit.successes >= this.halfOpenMaxAttempts) {
                circuit.state = CircuitState.CLOSED;
                circuit.failures = 0;
                circuit.successes = 0;
                this.logger.log(`Circuit breaker for ${platform} moved to CLOSED`);
            }
        } else {
            // Reset failure count on success
            circuit.failures = 0;
        }
    }

    private onFailure(platform: string, circuit: CircuitStats, now: number) {
        circuit.failures++;
        circuit.lastFailureTime = now;

        if (circuit.state === CircuitState.HALF_OPEN) {
            // Immediately open on failure in half-open
            circuit.state = CircuitState.OPEN;
            circuit.nextAttemptTime = now + this.timeout;
            this.logger.warn(`Circuit breaker for ${platform} moved to OPEN (failed in HALF_OPEN)`);
        } else if (circuit.failures >= this.failureThreshold) {
            circuit.state = CircuitState.OPEN;
            circuit.nextAttemptTime = now + this.timeout;
            this.logger.warn(`Circuit breaker for ${platform} moved to OPEN after ${circuit.failures} failures`);
        }
    }

    getState(platform: string): CircuitState {
        return this.getCircuit(platform).state;
    }

    reset(platform: string) {
        this.circuits.delete(platform);
        this.logger.log(`Circuit breaker for ${platform} has been reset`);
    }
}
