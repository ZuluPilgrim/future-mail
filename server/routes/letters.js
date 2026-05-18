const express = require('express');
const auth = require('../middleware/auth');
const { letterQueries } = require('../db/database');

const router = express.Router();
router.use(auth);

// GET /api/letters — list all letters
// Pending: subject + date only (no body, no view)
// Sent: subject + date (body available via GET /:id)
router.get('/', (req, res) => {
  try {
    const letters = letterQueries.findByUser.all(req.user.id);
    const stats   = letterQueries.stats.get(req.user.id);
    res.json({
      letters: letters.map(l => ({
        id:         l.id,
        subject:    l.sent ? l.subject : null,  // hide subject for pending
        send_at:    l.send_at,
        sent:       l.sent,
        sent_at:    l.sent_at,
        created_at: l.created_at,
        recipients: l.sent ? JSON.parse(l.recipients) : null, // hide recipients for pending
      })),
      stats,
    });
  } catch (err) {
    console.error('List letters error:', err);
    res.status(500).json({ error: 'Could not fetch letters' });
  }
});

// POST /api/letters — schedule a new letter
router.post('/', (req, res) => {
  const { subject, body, recipients, send_at } = req.body;

  if (!subject || !body || !recipients || !send_at) {
    return res.status(400).json({ error: 'Subject, body, recipients, and send_at are required' });
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'At least one recipient is required' });
  }
  if (recipients.length > 20) {
    return res.status(400).json({ error: 'Maximum 20 recipients allowed' });
  }

  const sendDate = new Date(send_at);
  if (isNaN(sendDate.getTime()) || sendDate <= new Date()) {
    return res.status(400).json({ error: 'send_at must be a valid future date' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const invalid = recipients.filter(r => !emailRegex.test(r));
  if (invalid.length > 0) {
    return res.status(400).json({ error: `Invalid email addresses: ${invalid.join(', ')}` });
  }

  try {
    const result = letterQueries.create.run(
      req.user.id,
      subject.trim(),
      body.trim(),
      JSON.stringify(recipients),
      sendDate.toISOString()
    );
    // Only return metadata after creation — never echo body back
    const letter = letterQueries.findByIdPending.get(result.lastInsertRowid, req.user.id);
    res.status(201).json({ letter });
  } catch (err) {
    console.error('Create letter error:', err);
    res.status(500).json({ error: 'Could not schedule letter' });
  }
});

// GET /api/letters/:id — view a SENT letter only (owner only, full content)
// Pending letters cannot be viewed — 404 is returned intentionally
router.get('/:id', (req, res) => {
  try {
    const letter = letterQueries.findByIdOwner.get(Number(req.params.id), req.user.id);
    if (!letter) {
      return res.status(404).json({ error: 'Letter not found or not yet delivered' });
    }
    res.json({ letter: { ...letter, recipients: JSON.parse(letter.recipients) } });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch letter' });
  }
});

// DELETE /api/letters/:id — delete any letter belonging to this user
router.delete('/:id', (req, res) => {
  try {
    const result = letterQueries.delete.run(Number(req.params.id), req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Letter not found' });
    }
    res.json({ message: 'Letter deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete letter' });
  }
});

module.exports = router;
