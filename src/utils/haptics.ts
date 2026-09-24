export function hapticLight() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export function hapticMedium() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(25);
  }
}

export function hapticHeavy() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([15, 30, 15]);
  }
}

export function hapticSuccess() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([10, 40, 20, 40, 10]);
  }
}

export function hapticError() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([30, 50, 30]);
  }
}
