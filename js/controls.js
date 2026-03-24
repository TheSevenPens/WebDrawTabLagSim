import { state } from './state.js';

function bindSlider(id, stateKey) {
  const slider = document.getElementById(id);
  const display = document.getElementById(id + 'Val');
  slider.addEventListener('input', () => {
    state[stateKey] = +slider.value;
    display.textContent = slider.value;
  });
}

function bindCheckbox(id, stateKey) {
  document.getElementById(id).addEventListener('change', (e) => {
    state[stateKey] = e.target.checked;
  });
}

export function initControls() {
  bindSlider('pointerLatency', 'pointerLatency');
  bindSlider('pointerSmoothing', 'pointerSmoothing');
  bindSlider('brushLatency', 'brushLatency');
  bindSlider('brushSmoothing', 'brushSmoothing');
  bindSlider('penSpeed', 'penSpeed');

bindCheckbox('showA', 'showA');
  bindCheckbox('showB', 'showB');
  bindCheckbox('showC', 'showC');
  bindCheckbox('showPointer', 'showPointer');
  document.getElementById('pointerStyle').addEventListener('change', (e) => {
    state.pointerStyle = e.target.value;
  });
  bindCheckbox('showTrackA', 'showTrackA');
  bindCheckbox('showTrackB', 'showTrackB');
  bindCheckbox('showTrackC', 'showTrackC');
  bindCheckbox('showCircleA', 'showCircleA');
  bindCheckbox('showCircleB', 'showCircleB');
  bindCheckbox('showCircleC', 'showCircleC');
}
