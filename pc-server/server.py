import asyncio
import json
import socket
import qrcode
from aiohttp import web
import pyautogui
import threading
import time

# Disable PyAutoGUI fail-safe
pyautogui.FAILSAFE = False
pyautogui.PAUSE = 0

class GamepadServer:
    def __init__(self):
        self.clients = set()
        self.current_keys = set()
        self.joystick_state = {'x': 0, 'y': 0}
        self.last_joystick_time = 0
        
    def get_local_ip(self):
        """Get local IP address"""
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
        except Exception:
            ip = '127.0.0.1'
        finally:
            s.close()
        return ip
    
    def generate_qr(self, url):
        """Generate QR code and display it"""
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(url)
        qr.make(fit=True)
        qr.print_ascii(invert=True)
        print(f"\nScan this QR code with your mobile device")
        print(f"Or manually visit: {url}")
        
        # Save QR code as image
        img = qr.make_image(fill_color="black", back_color="white")
        img.save("gamepad_qr.png")
        print("QR code saved as 'gamepad_qr.png'")
    
    def handle_joystick(self, x, y):
        """Convert joystick input to WASD keys"""
        current_time = time.time()
        
        # Deadzone
        if abs(x) < 0.2 and abs(y) < 0.2:
            self.release_wasd()
            return
        
        # Determine which keys should be pressed
        keys_to_press = set()
        
        if y < -0.3:  # Up
            keys_to_press.add('w')
        elif y > 0.3:  # Down
            keys_to_press.add('s')
            
        if x < -0.3:  # Left
            keys_to_press.add('a')
        elif x > 0.3:  # Right
            keys_to_press.add('d')
        
        # Release keys that should no longer be pressed
        for key in ['w', 'a', 's', 'd']:
            if key in self.current_keys and key not in keys_to_press:
                pyautogui.keyUp(key)
                self.current_keys.discard(key)
        
        # Press keys that should be pressed
        for key in keys_to_press:
            if key not in self.current_keys:
                pyautogui.keyDown(key)
                self.current_keys.add(key)
    
    def release_wasd(self):
        """Release all WASD keys"""
        for key in ['w', 'a', 's', 'd']:
            if key in self.current_keys:
                pyautogui.keyUp(key)
                self.current_keys.discard(key)
    
    def handle_button(self, button, pressed):
        """Handle button press/release"""
        key_map = {
            'Space': 'space',
            'E': 'e',
            'Q': 'q',
            'F': 'f',
            'Shift': 'shift',
            'Control': 'ctrl',
            'Enter': 'enter',
            'Escape': 'esc'
        }
        
        key = key_map.get(button)
        if not key:
            return
        
        try:
            if pressed:
                if key not in self.current_keys:
                    pyautogui.keyDown(key)
                    self.current_keys.add(key)
            else:
                if key in self.current_keys:
                    pyautogui.keyUp(key)
                    self.current_keys.discard(key)
        except Exception as e:
            print(f"Error handling button {button}: {e}")
    
    async def websocket_handler(self, request):
        """Handle WebSocket connections"""
        ws = web.WebSocketResponse()
        await ws.prepare(request)
        
        self.clients.add(ws)
        print(f"Client connected. Total clients: {len(self.clients)}")
        
        try:
            async for msg in ws:
                if msg.type == web.WSMsgType.TEXT:
                    try:
                        data = json.loads(msg.data)
                        msg_type = data.get('type')
                        msg_data = data.get('data')
                        
                        if msg_type == 'joystick':
                            x = msg_data.get('x', 0)
                            y = msg_data.get('y', 0)
                            self.handle_joystick(x, y)
                            
                        elif msg_type == 'button':
                            button = msg_data.get('button')
                            pressed = msg_data.get('pressed')
                            self.handle_button(button, pressed)
                            
                    except json.JSONDecodeError:
                        print("Invalid JSON received")
                    except Exception as e:
                        print(f"Error processing message: {e}")
                        
                elif msg.type == web.WSMsgType.ERROR:
                    print(f'WebSocket error: {ws.exception()}')
        finally:
            self.clients.discard(ws)
            print(f"Client disconnected. Total clients: {len(self.clients)}")
            # Release all keys when client disconnects
            self.release_wasd()
            for key in list(self.current_keys):
                try:
                    pyautogui.keyUp(key)
                except:
                    pass
            self.current_keys.clear()
        
        return ws
    
    async def start_server(self, host='0.0.0.0', port=8765):
        """Start the WebSocket server"""
        app = web.Application()
        app.router.add_get('/ws', self.websocket_handler)
        
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, host, port)
        await site.start()
        
        local_ip = self.get_local_ip()
        ws_url = f"ws://{local_ip}:{port}/ws"
        
        print("\n" + "="*60)
        print("Mobile Gamepad Server Started!")
        print("="*60)
        self.generate_qr(ws_url)
        print("\n" + "="*60)
        print(f"Server running on: {local_ip}:{port}")
        print("Waiting for mobile device to connect...")
        print("Press Ctrl+C to stop")
        print("="*60 + "\n")
        
        # Keep server running
        try:
            await asyncio.Event().wait()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            # Release all keys before shutdown
            self.release_wasd()
            for key in list(self.current_keys):
                try:
                    pyautogui.keyUp(key)
                except:
                    pass

async def main():
    server = GamepadServer()
    await server.start_server()

if __name__ == '__main__':
    print("Installing required packages...")
    print("Make sure you have installed:")
    print("  pip install aiohttp pyautogui qrcode[pil] pillow")
    print()
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")
