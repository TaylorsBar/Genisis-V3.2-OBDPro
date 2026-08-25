class J2534Driver:
    def __init__(self, default_dll_path=None):
        self.dll_path = default_dll_path
        self.active_dll = None

    def connect(self, protocol, dll_path=None):
        """
        Connects to the J2534 interface.
        Allows overriding the default DLL path based on application configuration.
        """
        self.active_dll = dll_path or self.dll_path
        if not self.active_dll:
            raise ValueError("J2534 DLL path must be provided either at initialization or connection.")
            
        print(f"Connecting to J2534 interface using DLL: {self.active_dll} with protocol: {protocol}")
        # Implementation for loading the specific DLL and connecting would go here
        return True

    def disconnect(self):
        if self.active_dll:
            print(f"Disconnecting from J2534 interface (DLL: {self.active_dll})")
            self.active_dll = None
        return True
