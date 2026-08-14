# RTR MT5 Windows Bridge

This bridge runs beside an installed, already authenticated MetaTrader 5 terminal on Windows. It only reads account metadata, open positions, and deal history, then sends normalized snapshots outbound to RTR over HTTPS.

## Requirements

- Windows x86-64
- Installed MetaTrader 5 terminal logged into the intended account
- Supported CPython version and `pip install -r requirements.txt`
- A strong bridge token configured independently on the bridge host and RTR backend

## Bridge-host environment

- `RTR_API_URL` — RTR FastAPI HTTPS origin
- `RTR_BRIDGE_TOKEN` — secret shared only with FastAPI
- `RTR_ACCOUNT_LABEL` — safe display label
- `RTR_BROKER` — safe broker display name
- `RTR_HISTORY_DAYS` — initial history window, default 30
- `RTR_BRIDGE_STATE_PATH` — optional protected cursor file path

No broker password is accepted by this program. Keep the MT5 terminal authenticated using the bridge host's protected Windows profile. Schedule `python bridge.py` every 1–5 minutes with Windows Task Scheduler after validating one manual run.

## First Windows connection

1. Install MetaTrader 5 from the broker and open it.
2. Log into the intended account manually inside MT5. Confirm the connection indicator is online.
3. Install 64-bit CPython 3.11 or 3.12 and enable **Add Python to PATH**.
4. Open PowerShell in this directory and run:
   ```powershell
   py -3.12 -m venv .venv
   Set-ExecutionPolicy -Scope Process Bypass
   .\.venv\Scripts\Activate.ps1
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```
5. Generate a token without printing it, save it in the Windows user environment, and copy it to the clipboard:
   ```powershell
   $bytes = New-Object byte[] 48
   [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   $token = [Convert]::ToBase64String($bytes)
   [Environment]::SetEnvironmentVariable("RTR_BRIDGE_TOKEN", $token, "User")
   Set-Clipboard -Value $token
   Remove-Variable token
   ```
6. In Render, add `MT5_BRIDGE_TOKEN` and paste the clipboard value into the secret value field. Save it without exposing it in logs.
7. Configure the remaining Windows user environment values:
   ```powershell
   [Environment]::SetEnvironmentVariable("RTR_API_URL", "https://YOUR-RTR-BACKEND.onrender.com", "User")
   [Environment]::SetEnvironmentVariable("RTR_ACCOUNT_LABEL", "Personal Live", "User")
   [Environment]::SetEnvironmentVariable("RTR_BROKER", "Your Broker", "User")
   [Environment]::SetEnvironmentVariable("RTR_BRIDGE_STATE_PATH", "$env:LOCALAPPDATA\RTR-TradeScope\mt5-state.json", "User")
   [Environment]::SetEnvironmentVariable("RTR_HISTORY_DAYS", "30", "User")
   ```
8. Close and reopen PowerShell so the new user variables load, reactivate the virtual environment, and run `python bridge.py`.
9. Confirm the output reports the terminal, masked account, broker, server, positions, deals, upload status, and cursor without showing secrets.
10. Open RTR **Settings → Trading Accounts**, confirm the account and open positions, then verify a successful row exists in `mt5_sync_runs`.

If automatic terminal discovery fails, set `MT5_TERMINAL_PATH` to the full protected path of `terminal64.exe`. The bridge state folder must exist and should be readable only by the Windows user running the scheduled task.
