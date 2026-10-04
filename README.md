# 🔤 Finish The Word

A real-time multiplayer word-chain survival game that runs in the browser. Create a room, share the 4-letter code with your friends, and take turns typing words before the timer runs out. Last player standing wins.

Built with **Node.js**, **Express** and **Socket.IO**, with a 3D animated card UI written in plain HTML and CSS (no frameworks).

> Inspired by the Roblox game *Finish The Word*. This is an independent fan project and is not affiliated with Roblox.

---

## ✨ Features

- 🎮 **Real-time multiplayer** for 2 to 12 players per room
- 🔑 **Room codes**: the server generates a random 4-letter code, and friends join with it
- 🕹️ **Waiting room** with a player list and a Leave button
- ⌨️ **Live typing**: everyone sees what the current player is typing, letter by letter
- ✨ **Pop-up letter animation**, for the player typing and for everyone watching
- ⏱️ **Circular 14-second timer** that turns red when time is almost up
- 👀 **Spectator mode**: eliminated players keep watching the match live
- 🏆 **Winner screen** with confetti and a host-only **Restart match** button
- 🧊 **3D tilt card UI** that follows your mouse or finger, floats, and presses in like a button
- 📱 **Mobile friendly**: the card scales to fit any screen, so the page never scrolls
- 📖 **Dictionary check**: the server validates every word against a ~274,000-word English list

---

## 🧠 How to play

1. Enter your name, then **Create Room** or **Join Room** with a code.
2. The host starts the match once **2 or more** players are in the room.
3. **Player 1** (the host) gets **4 random letters** and picks one. Then they type a word starting with that letter.
4. The **last letter** of that word is passed to the next player, who must type a word starting with it.
   Example: `AIR` → next player needs a word starting with **R**.
5. You have **14 seconds** per turn. If time runs out, you lose **1 life**. Everyone starts with **2 lives**.
6. A full loop around the table counts as **1 round**. Every **10 rounds**, the ending gets longer:

   | Rounds | Letters you must continue from |
   |--------|--------------------------------|
   | 0–9    | last **1** letter              |
   | 10–19  | last **2** letters (`EDUCATION` → `ON`) |
   | 20–29  | last **3** letters             |
   | ...    | +1 every 10 rounds             |

7. **Whenever anyone loses a life, the round counter resets to 0**, so the endings get short again.
8. At 0 lives you're out, but you can keep watching as a spectator.
9. The last player alive wins 🏆. The host can restart the match after a 5-second cooldown.

**Other rules**
- Words can be repeated.
- A wrong or invalid word doesn't cost a life. You can try again until the timer ends.
- If a word is shorter than the required ending, the player gets the whole word.
- Players can't join a match that has already started.
- If the host leaves, the next player in the room becomes the host.

---

## 🚀 Run it locally

**Requirements:** [Node.js](https://nodejs.org) 18 or newer.

```bash
# 1. clone the repo
git clone https://github.com/YOUR-USERNAME/finish-the-word.git
cd finish-the-word

# 2. install dependencies
npm install

# 3. start the server
npm start
```

Open **http://localhost:3000** in your browser. Open a second tab to be player 2.

### Play with friends on the same Wi-Fi

1. Find your computer's local IP address (on Windows, run `ipconfig` and look for **IPv4 Address**, e.g. `192.168.1.5`).
2. Friends open `http://192.168.1.5:3000` on their phones or PCs.
3. If Windows shows a firewall prompt the first time, click **Allow**.

---

## 🌐 Deploy it online (Render)

1. Push this project to a GitHub repository. **Don't upload `node_modules`.**
2. Create a free account at [render.com](https://render.com) and click **New → Web Service**.
3. Connect your GitHub repo and use these settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Click **Create Web Service**. When it finishes, share the `.onrender.com` link with your friends.

> **Free plan notes:** Render spins down free services after 15 minutes without traffic, and waking up can take about a minute. Rooms are stored in memory, so they're lost if the server restarts or sleeps.

---

## 🗂️ Project structure

```
finish-the-word/
├── server.js       # Express + Socket.IO server and all the game logic
├── index.html      # Game client (screens, 3D tilt, networking)
├── style.css       # 3D card styles, animations, game screens
├── package.json
└── package-lock.json
```

## ⚙️ Customizing the game

The main settings are at the top of `server.js`:

```js
const TURN_MS = 14000;        // time per turn (milliseconds)
const START_LIVES = 2;        // lives per player
const MIN_PLAYERS = 2;        // players needed to start
const MAX_PLAYERS = 12;       // room size limit
const RESTART_LOCK_MS = 5000; // winner screen lock before restart
const LETTER_POOL = '...';    // letters offered at the start of a match
```

## 🛠️ Tech stack

- **Node.js** and **Express** for the web server
- **Socket.IO** for real-time communication
- **word-list** for the English dictionary
- Plain **HTML, CSS and JavaScript** on the client

## ⚠️ Known limitations

- Rooms live in server memory. There's no database, so a restart clears them.
- There's no reconnect support. If a player's connection drops, they leave the room.
- The dictionary is a standard English word list, so slang, brand names and most proper nouns aren't accepted.

## 📄 License

Add a license of your choice (for example MIT) before sharing publicly.

---

Made with ❤️ by **YOUR NAME**
