export function speak(text) {
  const spoken = formatSANForSpeech(text);
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  synth.speak(utterance);
}

export function formatSANForSpeech(san) {
  if (san === 'O-O') return 'Castles kingside';
  if (san === 'O-O-O') return 'Castles queenside';

  san = san.replace(/x/g, ' takes ');
  san = san.replace(/=/g, ' promotes to ');
  san = san.replace(/K/g, 'King ');
  san = san.replace(/Q/g, 'Queen ');
  san = san.replace(/R/g, 'Rook ');
  san = san.replace(/B/g, 'Bishop ');
  san = san.replace(/N/g, 'Knight ');

  return san.replace(/\s+/g, ' ').trim();
}
