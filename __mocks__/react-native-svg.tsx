import { Component, createElement } from 'react';

// Class components (like the real library) rendering host elements that keep
// their props, so tests can inspect them and Reanimated can resolve refs.
const host = (name: string) =>
  class extends Component<Record<string, unknown>> {
    // Reanimated's JS updater calls this on animated svg components.
    setNativeProps() {}
    render() {
      return createElement(name, this.props);
    }
  };

export const Svg = host('Svg');
export const Circle = host('Circle');
export const Defs = host('Defs');
export const LinearGradient = host('LinearGradient');
export const Stop = host('Stop');
export const Rect = host('Rect');
export const Path = host('Path');
export default Svg;
