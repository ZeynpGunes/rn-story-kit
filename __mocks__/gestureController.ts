import { DeviceEventEmitter } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

type Payload = Record<string, number>;

const DEFAULTS: Payload = {
  x: 0,
  y: 0,
  absoluteX: 0,
  absoluteY: 0,
  translationX: 0,
  translationY: 0,
  velocityX: 0,
  velocityY: 0,
  numberOfPointers: 1,
};

/**
 * Drives one gesture, found by its testID, one state at a time. RNGH's own
 * fireGestureHandler always runs a whole BEGAN -> ACTIVE -> END sequence;
 * the tests here need to pause in between (mid-drag, mid-press).
 */
export function createGestureController(testID: string) {
  const emit = (state: State, oldState?: State, payload: Payload = {}) => {
    const { handlerTag } = getByGestureTestId(testID);
    // Updates carry no oldState: RNGH tells them from state changes by that.
    const event = { ...DEFAULTS, ...payload, handlerTag, state, oldState };
    DeviceEventEmitter.emit(
      oldState === undefined
        ? 'onGestureHandlerEvent'
        : 'onGestureHandlerStateChange',
      event
    );
  };
  return {
    begin: (p?: Payload) => emit(State.BEGAN, State.UNDETERMINED, p),
    activate: (p?: Payload) => emit(State.ACTIVE, State.BEGAN, p),
    update: (p?: Payload) => emit(State.ACTIVE, undefined, p),
    end: (p?: Payload) => emit(State.END, State.ACTIVE, p),
    cancel: (p?: Payload) => emit(State.CANCELLED, State.ACTIVE, p),
  };
}
