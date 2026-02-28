import sys
import tkinter as tk
from tkinter import filedialog

def main():
    root = tk.Tk()
    root.withdraw() # Hide the main window
    root.attributes('-topmost', True) # Bring the dialog to the front
    
    folder_path = filedialog.askdirectory(parent=root, title="Select Download Folder")
    
    if folder_path:
        print(folder_path)

if __name__ == "__main__":
    main()
