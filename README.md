# wifi-gamepad


Perfect! Now here's the complete file structure and setup guide:
📁 File Structure
mobile-gamepad/
│
├── pc-server/
│   └── server.py          # Python WebSocket server
│
├── mobile-web/
│   ├── index.html         # Mobile gamepad interface
│   └── gamepad.js         # Controller logic
│
└── README.md              # Setup instructions
🚀 Complete Setup Guide
Step 1: Create the Project Folders
Create the folder structure above on your PC.
Step 2: Set Up PC Server

Install Python (if not already installed) from python.org
Install required packages:

bashpip install aiohttp pyautogui qrcode[pil] pillow

Save the Python server code (from the artifact above) as server.py in the pc-server folder
Run the server:

bashcd pc-server
python server.py

A QR code will appear in the terminal and save as gamepad_qr.png

Step 3: Set Up Mobile Web Interface

Save the HTML code as index.html in the mobile-web folder
Save the JavaScript code as gamepad.js in the same mobile-web folder

Step 4: Host the Mobile Web Interface
You have 3 options to serve the HTML files:
Option A: Simple Python HTTP Server (Recommended)
bashcd mobile-web
python -m http.server 8000
Then the mobile URL becomes: http://YOUR_PC_IP:8000/index.html?server=ws://YOUR_PC_IP:8765/ws
Option B: Use Any Web Server

Use XAMPP, WAMP, or any web server
Place files in the web root directory
Access via your local network IP

Option C: Direct File Access

Just open index.html in your mobile browser
Manually enter the WebSocket URL shown by the server

Step 5: Connect Mobile to PC
Method 1 (QR Code):

Run the Python server - it displays a WebSocket URL
Create a QR code that points to: http://YOUR_PC_IP:8000/index.html?server=ws://YOUR_PC_IP:8765/ws
Scan with your phone
The gamepad interface loads and connects automatically

Method 2 (Manual):

Open index.html on your mobile browser
The WebSocket URL will be in the query parameter
It connects automatically

📱 How to Use

Connect: Scan QR or open the URL
Play: Use the virtual gamepad to control PC games
Customize:

Tap ⚙️ to enter edit mode
Drag controls to reposition
Use +/- buttons to resize
Tap 💾 to save layout
Tap ⚙️ again to exit edit mode



🎮 Button Mappings

Joystick → WASD keys
A Button → Space
B Button → E
X Button → Q
Y Button → F
L Button → Shift
R Button → Ctrl
START → Enter
SELECT → Escape

🔧 Troubleshooting

Can't connect?

Ensure both devices are on the same WiFi network
Check firewall settings (allow Python/port 8765)
Verify the IP address is correct


High latency?

Use 5GHz WiFi instead of 2.4GHz
Move closer to the router
Close other network-heavy apps


Controls not working?

Make sure edit mode is OFF
Check that the game window has focus
Try restarting both server and client



The system is now fully functional with pure HTML/CSS/JavaScript! No frameworks needed, and it works on any mobile browser.
