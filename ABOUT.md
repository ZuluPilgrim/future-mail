# FutureMail — Letters Across Time

## About This Project

FutureMail is a self-hosted email time capsule application that lets you write messages today and deliver them to anyone at a specified date in the future — days, months, or years from now.

But the application itself is only half the story.

---

## The Real Experiment

This project was first and foremost a **proof of concept** — not of the app, but of a question:

> *Can AI assist someone with an understanding of software, but little hands-on coding experience, to build a reasonably decent, secure, production-ready application from scratch?*

The answer, it turns out, is yes.

The last time I did any serious coding was in **1993** — just before object-oriented programming became mainstream. I was writing Pascal. Since then my relationship with code has been conceptual rather than practical: understanding architecture, security principles, and how systems fit together, without writing much of it myself.

With that background — and with **Claude AI** as my development partner — I set out to build something I would actually want to use and run myself.

---

## What I Brought to the Table

- A clear idea of what I wanted to build
- An understanding of security requirements (encryption at rest, 2FA, privacy by design, admin boundaries)
- The ability to ask the right questions and push back when something wasn't right
- Patience — and a willingness to keep iterating

## What Claude Brought to the Table

- Everything else

---

## The Process

The project took approximately **15 hours** of active collaboration from initial concept to this MVP. I used Claude's entry-level plan and hit the session limit **three times**, each time requiring a new session and picking up where we left off — which contributed to the overall timeline.

What emerged is a full-stack application with:

- A React frontend with a deliberately considered UI
- A Node.js/Express backend
- An AES-256 encrypted SQLite database
- Two-factor authentication (TOTP)
- Encrypted backups with a user-held recovery key
- A full admin panel
- Docker support for self-hosted deployment

---

## Why Self-Hosted?

I wanted something I could run on my own infrastructure, where I control the data, the access, and the privacy. No third-party services holding anyone's personal letters. No subscription. No lock-in.

The Docker deployment means anyone with a server and Docker installed can have this running in a single command.

---

## Is It Production Ready?

This is an MVP — a **Minimum Viable Product** — and should be treated as such. It has not been independently security audited. Use it, test it, and contribute to it with that in mind.

That said, for a proof of concept built by someone whose last serious coding was done on a machine running DOS, I'm reasonably happy with where it landed.

---

## Acknowledgement

This project would not exist without **Claude AI** (Anthropic). Every line of code was written by Claude, guided by me. It is an honest demonstration of what thoughtful human-AI collaboration can produce — and a genuine answer to the question of whether AI can meaningfully lower the barrier to building real software.

---

*FutureMail — started as an experiment, finished as something I'll actually use.*

---

## Disclaimer

Please don't roast me for AI slop — as stated, this was just a proof of concept. I also haven't had time to test it thoroughly, but at first glance it works as intended and I am very happy with — and may I say impressed by — the result.

This code is used at your own risk and has not been audited in any way. That will be my next project. 😉

Enjoy.
