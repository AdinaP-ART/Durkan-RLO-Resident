/* ============================================================
   api/send-sms.js — Vercel serverless function
   Sends SMS via Twilio. Credentials come from Vercel
   environment variables — never hardcoded here.
============================================================ */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, body } = req.body || {};

  if (!to || !body) {
    return res.status(400).json({ error: 'Missing "to" or "body"' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: 'Twilio credentials not configured in Vercel environment variables' });
  }

  // Normalise UK numbers: 07xxx -> +447xxx
  let toNumber = String(to).replace(/\s+/g, '');
  if (toNumber.startsWith('07')) toNumber = '+44' + toNumber.slice(1);
  if (toNumber.startsWith('447')) toNumber = '+' + toNumber;

  try {
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: toNumber,
          From: fromNumber,
          Body: body,
        }),
      }
    );

    const data = await twilioRes.json();

    if (twilioRes.ok) {
      return res.status(200).json({ success: true, sid: data.sid, status: data.status });
    } else {
      return res.status(twilioRes.status).json({ success: false, error: data.message || 'Twilio error', code: data.code });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
