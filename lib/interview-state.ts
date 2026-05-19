export type InterviewState =
  | "IDLE"
  | "CONNECTING"
  | "READY"
  | "AI_SPEAKING"
  | "WAITING_FOR_ANSWER"
  | "CANDIDATE_SPEAKING"
  | "PROCESSING_ANSWER"
  | "FINISHED"
  | "ERROR";

export type InterviewStateListener = (
  state: InterviewState
) => void;

export class InterviewStateMachine {
  private currentState: InterviewState = "IDLE";

  private listeners: InterviewStateListener[] = [];

  getState() {
    return this.currentState;
  }

  setState(nextState: InterviewState) {
    this.currentState = nextState;

    this.listeners.forEach((listener) => {
      listener(nextState);
    });
  }

  subscribe(listener: InterviewStateListener) {
    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(
        (x) => x !== listener
      );
    };
  }

  reset() {
    this.setState("IDLE");
  }
}
