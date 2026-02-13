  export const ENV = {
    EMAIL: "LT_EMAIL",
    PASSWORD: "LT_PASSWORD",
  };
  
  // Sun=0 Mon=1 Tue=2 Wed=3 Thu=4 Fri=5 Sat=6
  export const TARGET_WEEKDAY = 6; // saturday
  export const TARGET_DAY_INDEX = TARGET_WEEKDAY;
  
  // Tile matching (make stricter if you want)
export const MUST_INCLUDE = ["3:30 PM", "5:00", "Pickleball Open Play"];  
  // Reservation open time (local time)
  export const OPEN_TIME = {
    hour: 17,
    minute: 51,
    second: 0,
  };
  
  // How early to login
  export const READY_MINUTES_BEFORE = 1;
  
  // Retry behavior
  export const RESERVE_RETRY_MS = 350;
  export const RESERVE_MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes
  
  // Behavior toggles
  export const USE_WAIT_UNTIL_OPEN = true;
  
  // URLs
  export const LOGIN_URL =
    "https://my.lifetime.life/login.html?resource=%2Fclubs%2Fva%2Ffairfax.html";
  
  // Schedule builder defaults
  export const SCHEDULE_DEFAULTS = {
    clubPath: "https://my.lifetime.life/clubs/va/fairfax/classes.html",
    location: "Fairfax",
    interest: "Pickleball Open Play",
    mode: "week",
    teamMemberView: true,
  };
  