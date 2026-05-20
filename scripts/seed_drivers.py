"""
seed_drivers.py — Seeds yards and drivers tables from the Excel data.
Run once: python scripts/seed_drivers.py
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env.local")

sb = create_client(
    os.environ["NEXT_PUBLIC_SUPABASE_URL"],
    os.environ["SUPABASE_SERVICE_ROLE_KEY"],
)

# ── Yards ────────────────────────────────────────────────────────────────────

YARDS = [
    {"yard_name": "Dallas",            "address": "1722 Plantation Rd",  "city": "Dallas",     "state": "TX", "latitude": 32.8211, "longitude": -96.8543},
    {"yard_name": "Ft Worth",          "address": "2525 Brennan Ave",     "city": "Fort Worth", "state": "TX", "latitude": 32.7898, "longitude": -97.3276},
    {"yard_name": "Caddo Mills",       "address": "10460 FM 1570",        "city": "Greenville", "state": "TX", "latitude": 33.0779, "longitude": -96.1524},
    {"yard_name": "Tyler - Reg",       "address": "407 E NE Loop 323",    "city": "Tyler",      "state": "TX", "latitude": 32.3901, "longitude": -95.2915},
    {"yard_name": "Waco",              "address": "1001 Enterprise Blvd", "city": "Hewitt",     "state": "TX", "latitude": 31.4243, "longitude": -97.1937},
    {"yard_name": "Melissa",           "address": "4160 Co Rd 420",       "city": "Melissa",    "state": "TX", "latitude": 33.2830, "longitude": -96.5331},
    {"yard_name": "Ft Worth - Lemming","address": "2601 Leming St",       "city": "Fort Worth", "state": "TX", "latitude": 32.8026, "longitude": -97.3217},
]

# ── Drivers (Last, First → first_name / last_name) ───────────────────────────

RAW_DRIVERS = [
    ("Abdulallah, Samir",    "Ft Worth",          "02:00:00"),
    ("Abdulla, Omar",        "Dallas",            "18:00:00"),
    ("Al Azawe, Omer",       "Ft Worth",          "20:00:00"),
    ("Alvarado, Juan",       "Dallas",            "04:30:00"),
    ("Bowman, Teddy",        "Dallas",            "22:00:00"),
    ("Brown, Nigel",         "Tyler - Reg",       "07:00:00"),
    ("Chapman, Byron",       "Dallas",            "02:00:00"),
    ("Clark, Robert",        "Tyler - Reg",       "02:00:00"),
    ("Cruz, Carlos",         "Dallas",            "13:00:00"),
    ("Curry, Nick",          "Ft Worth",          "03:00:00"),
    ("Dosal, Rosendo",       "Dallas",            "23:00:00"),
    ("Ford, Cedric",         "Caddo Mills",       "02:00:00"),
    ("Fullerton, Richard",   "Waco",              "06:00:00"),
    ("Gardner, Quin",        "Caddo Mills",       "04:00:00"),
    ("Gardner, Robert",      "Dallas",            "01:00:00"),
    ("Gie, Ashton",          "Dallas",            "22:00:00"),
    ("Gonzalez, Carlos",     "Dallas",            "09:00:00"),
    ("Granados, Humberto",   "Dallas",            "05:00:00"),
    ("Greer, Zacharey",      "Dallas",            "10:00:00"),
    ("Hooper, Jonathan",     "Dallas",            "09:00:00"),
    ("Howard, Jevonni",      "Dallas",            "06:00:00"),
    ("Johnson, Reginald",    "Tyler - Reg",       "03:00:00"),
    ("Jones, Joseph",        "Dallas",            "06:00:00"),
    ("Little, Kenneth",      "Ft Worth",          "00:00:00"),
    ("Lopez, Anthony",       "Ft Worth - Lemming","07:00:00"),
    ("Lowe, Jeremy",         "Dallas",            "18:00:00"),
    ("Masih, Ishtiaq",       "Dallas",            "12:00:00"),
    ("Mikhail, Amir",        "Dallas",            "14:00:00"),
    ("Miller, Rufus",        "Dallas",            "12:00:00"),
    ("Montgomery, David",    "Ft Worth",          "00:00:00"),
    ("Nelson, Jasen",        "Dallas",            "00:00:00"),
    ("Nissan, Bilal",        "Ft Worth",          "18:00:00"),
    ("Nuncio, Daniel",       "Dallas",            "12:00:00"),
    ("Payne, Lionel",        "Dallas",            "09:00:00"),
    ("Proctor, Brian",       "Ft Worth",          "04:00:00"),
    ("Randhawa, Prabhjot",   "Dallas",            "07:00:00"),
    ("Seahorn, Terry",       "Tyler - Reg",       "14:00:00"),
    ("Soto, Allan",          "Dallas",            "12:00:00"),
    ("Soto, Manuel",         "Dallas",            "21:00:00"),
    ("Stapleton, Deandre",   "Ft Worth",          "16:00:00"),
    ("Stephens, Daryl",      "Dallas",            "01:00:00"),
    ("Steward, Troy",        "Dallas",            "22:00:00"),
    ("Watkins, Scott",       "Dallas",            "01:00:00"),
    ("White, Micheal",       "Ft Worth - Lemming","19:00:00"),
    ("Williams, Dennis",     "Dallas",            "02:00:00"),
    ("Willis, Rodameon",     "Dallas",            "02:00:00"),
    ("Wright, Roderick",     "Tyler - Reg",       "03:00:00"),
    ("Xiques, Mario",        "Ft Worth",          "04:00:00"),
]


def main():
    # Seed yards
    sb.table("yards").upsert(YARDS, on_conflict="yard_name").execute()
    result = sb.table("yards").select("yard_id, yard_name").execute()
    yard_map = {r["yard_name"]: r["yard_id"] for r in result.data}
    print(f"Yards seeded: {len(yard_map)}")
    for name, yid in yard_map.items():
        print(f"  {yid}: {name}")

    # Build driver records
    drivers = []
    for raw_name, yard_name, start_time in RAW_DRIVERS:
        last, first = [p.strip() for p in raw_name.split(",", 1)]
        yard_id = yard_map.get(yard_name)
        if yard_id is None:
            print(f"  WARNING: yard '{yard_name}' not found for {first} {last}", file=sys.stderr)
        drivers.append({
            "first_name":         first,
            "last_name":          last,
            "yard_id":            yard_id,
            "default_start_time": start_time,
            "active":             True,
        })

    sb.table("drivers").upsert(drivers, on_conflict="first_name,last_name").execute()
    print(f"Drivers seeded: {len(drivers)}")


if __name__ == "__main__":
    main()
