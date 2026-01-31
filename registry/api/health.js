export default function handler(req, res) {
  res.json({ status: 'ok', service: 'moltspeak-registry', version: '0.1.0' });
}
