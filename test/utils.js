import TestUtils from 'react-addons-test-utils';

export function shallowlyRenderedOutput(Component) {
  const shallowRenderer = TestUtils.createRenderer();
  shallowRenderer.render(Component);

  return shallowRenderer.getRenderOutput();
}
