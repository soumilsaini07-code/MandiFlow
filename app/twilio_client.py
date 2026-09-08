"""
DEPRECATED — replaced by app/whatsapp_client.py.

This project switched from Twilio's WhatsApp Sandbox to Meta's WhatsApp
Cloud API, because Twilio now requires a payment method on file even for
its free trial's WhatsApp Sandbox, and this project needed a genuinely
free (no credit card) path to a live bot.

Nothing in the codebase imports this file anymore. It's kept only so the
history of the switch is visible in the repo; it is safe to delete.
See app/whatsapp_client.py for the real, currently-used implementation,
and README.md's "Setup" section for the new Meta Developer signup steps.
"""
