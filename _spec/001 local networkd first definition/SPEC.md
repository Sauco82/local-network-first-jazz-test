# Local network first definition

1. Define the schema using groups of accounts as user and accounts as devices
2. Define a UI to invite devices to the user
3. Mount a server from desktop app
4. Detect other devices on the network
5. If device with server is found, connect to it
6. Create invites for game, for now just make it so each player can pass their turn to the other player

# Adding user data to DeviceAccount

1. create user data with current device and default name based on device name
2. add device to user data
3. assign user data to DeviceAccount userData

# Joining other devices

1. Create userData invitation link for other device to join with selectable role
2. Use userData as own user data
3. Add device account to user data

# currently wrong

No device name definition
Creation of user data on user migration instead of on demand

# Remove legacy

# Redesign UI
