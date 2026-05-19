# Windows Task Scheduler Setup

This runs `sync.py` every 15 minutes to keep Supabase in sync with the Loads Feed spreadsheet.

## One-time setup

### 1. Install Python dependencies

Open a command prompt and run:

```
pip install openpyxl supabase python-dotenv pywin32
```

### 2. Create the scheduled task

Open **Task Scheduler** (search in Start menu), then:

1. Click **Create Task** (not "Basic Task")
2. **General tab**
   - Name: `FuelCity Loads Sync`
   - Check **Run whether user is logged on or not**
   - Check **Run with highest privileges**

3. **Triggers tab** → New
   - Begin the task: **On a schedule**
   - Settings: **Daily**, starting today
   - Repeat task every: **15 minutes** for a duration of **1 day**
   - Check **Enabled**

4. **Actions tab** → New
   - Action: **Start a program**
   - Program/script: `python`
     (or full path, e.g. `C:\Users\kimbe\AppData\Local\Programs\Python\Python312\python.exe`)
   - Add arguments: `scripts\sync.py`
   - Start in: `C:\Users\kimbe\fcproject2026`

5. **Conditions tab**
   - Uncheck "Start the task only if the computer is on AC power" (if on a laptop)

6. **Settings tab**
   - Check **Run task as soon as possible after a scheduled start is missed**
   - If the task is already running: **Do not start a new instance**

7. Click **OK** and enter your Windows password when prompted.

## Verify it's working

- Check `scripts\sync.log` — a new entry should appear every 15 minutes.
- In Supabase dashboard, check the `loads` table — `synced_at` should update every 15 minutes.

## Note on Excel refresh

The sync script will attempt to open Excel, trigger a data refresh, save, and close before reading the file. This requires Excel to be installed and the ODBC connection to be configured on this machine. If Excel fails to refresh (e.g. Excel isn't installed), the script falls back to reading whatever data is currently in the file and logs a warning.
