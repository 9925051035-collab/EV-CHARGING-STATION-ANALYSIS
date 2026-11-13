# EV Charging Station Analysis — 3D Dual-Hub Campus & Electric Vehicle Telemetry Platform
### CSE221 – Interactive Data Visualization Using D3.js & Three.js

An enterprise-grade, immersive 3D analytics dashboard and digital twin for electric vehicle charging infrastructure. Built for **CSE221**, this platform pairs high-density data visualization powered by **D3.js v7** with an expansive **Three.js WebGL** 3D charging campus simulator, an interactive **3D Electric Vehicle Simulation Studio** with historical session playback, advanced **CSS 3D perspective physics**, and real-time data-driven analytics.

---

## 🎨 Enterprise Master Palette

The visual design follows a vibrant, carefully balanced enterprise color system:

| Swatch | Color Name | Hex Code | Purpose |
| :---: | :--- | :--- | :--- |
| 🟦 | **Midnight Navy** | `#111827` | Primary background, cards, and top navigation |
| 🩵 | **Electric Cyan** | `#00E5FF` | Interactive highlights, energy streams, and active focus |
| 💜 | **Vibrant Violet** | `#A855F7` | Analytics, secondary accents, and venue metrics |
| 🟩 | **Electric Green** | `#39FF88` | **Slow AC Hub identity**, Level 2 bays, positive metrics |
| 🟧 | **Amber Orange** | `#FF9F43` | **Fast DC Hub identity**, rapid charging bays, energy intensity |
| 🩷 | **Neon Pink** | `#F472B6` | **Vehicle Simulation telemetry**, playback scrubber, active sessions |

---

## 🏎️ 3D Electric Vehicle Simulation Studio (Three.js WebGL)

The platform features an interactive **3D Electric Vehicle Simulation Studio** directly integrated into the dashboard, connected dynamically to the real charging records dataset.

### 1. Vehicle ID Filtering & Session Architecture
- **Dataset Mapping**: Mapped directly from `UserID` in `data/ChargingRecords.csv` (**2,337 unique vehicle IDs** across 72,856 total records).
  - Unregistered/guest vehicle group: `UserID 0` (31,553 sessions).
  - Top frequent registered vehicles with full historical profiles:
    - **Vehicle #31**: 353 charging sessions
    - **Vehicle #95**: 348 charging sessions
    - **Vehicle #179**: 341 charging sessions
    - **Vehicle #40**: 323 charging sessions
    - **Vehicle #36**: 300 charging sessions
- **Interactive Vehicle Selector**:
  - Live search input filter (`#filterVehicleSearch`).
  - Vehicle dropdown populated with session counts (`#filterVehicleSelect`).
  - One-click **Quick Frequent Vehicle Pills** (`#95`, `#31`, `#179`, `#40`, `#36`).
  - **Session Selector Dropdown** displaying date, time, duration, energy delivered, and charger standard for each individual recorded session.
  - One-click **Reset Filter** button returning to aggregate campus view.

### 2. High-Fidelity 3D Electric Vehicle Model
- **Procedural Three.js Geometry**:
  - Aerodynamic EV chassis with continuous curves and subtle wheel arches.
  - Panoramic smoked-glass greenhouse cabin.
  - Front cyber-strip dual projector headlights with cyan glow.
  - Rear continuous full-width taillight lightbar with crimson glow.
  - Detailed alloy wheels with inner brake rotors and calipers.
  - Animated motorized charging port door on the left rear quarter panel.
  - Illuminated internal charging socket halo.
  - Studio turntable ground plane with circular grid rings, subtle radial lighting, and studio shadows.
- **Interactive Camera Controls**:
  - OrbitControls drag-to-rotate and scroll-to-zoom.
  - 5 Instant Camera Angles: **Isometric 3D**, **Front View**, **Side Profile**, **Rear View**, and **Close-up Port View**.
- **Interactive Paint Color Customizer**:
  - Live vehicle paint selector with 5 real-time metallic automotive finishes:
    - **Electric Blue** (`#00e5ff`)
    - **Cyber Violet** (`#a855f7`)
    - **Emerald Green** (`#39ff88`)
    - **Solar Amber** (`#ff9f43`)
    - **Stealth Midnight** (`#1e293b`)

### 3. Realistic Charging Playback Simulation
- **4-Stage Animation Lifecycle**:
  - **Stage 1 (Identification)**: Displays vehicle ID, detects station type, opens charging port door, and illuminates the socket halo.
  - **Stage 2 (Connection)**: Kiosk dispenser deploys flexible 3D spline charging cable connected into the vehicle charging port.
  - **Stage 3 (Active Charging & Energy Transfer)**: Glowing particle streams travel along the 3D cable curve into the vehicle port; 10-cell battery pack progressively charges with pulse effects.
  - **Stage 4 (Session Complete)**: Battery reaches full recorded energy delivered; particles stabilize into a solid green/amber glow.
- **Playback Telemetry Bar**:
  - **Play / Pause** toggle.
  - **Rewind (⏮)** button.
  - **Previous (◀) & Next (▶) Session** quick jump controls.
  - **Speed Multipliers**: `1x`, `2x`, and `5x` acceleration.
  - **Interactive Scrubber Bar**: Drag or click anywhere on the scrub bar to jump to any stage of the charging session (0% to 100%).
  - **Time Elapsed & Remaining Counter**: Dynamically calculated from recorded session duration.

### 4. Fast DC vs. Slow AC Visual Differentiation
The 3D studio dynamically reconfigures its hardware and lighting depending on whether the selected session used **Slow AC** (`ChargerType 0`) or **Fast DC** (`ChargerType 1`):
- **Slow AC (Level 2)**: Slim green pedestal, single-phase flexible cable, **Electric Green (`#39FF88`)** LED indicators and particle stream, simulated lower-power transfer rate.
- **Fast DC (Rapid Supercharger)**: Robust heavy-duty cabinet with dual cooling vents, thicker high-voltage cable, **Amber Orange (`#FF9F43`)** LED indicators and energetic particle stream, simulated rapid power delivery.

### 5. Interactive 3D Battery Module HUD
- **10-Cell Modular Battery Stack**:
  - Realistic battery pack graphic housing 10 individual stacked cells.
  - Real-time sequential fill animation as charging playback progresses.
  - Active cell pulse keyframe animation.
- **Real-Time Telemetry Readouts**:
  - Real-time percentage readout (0% – 100%).
  - Dynamic Energy Delivered counter in kWh.
  - Dynamic Charging Rate in kW.
  - Scientific Formula Badge:
    $$\text{Average Power (kW)} = \frac{\text{Recorded Demand (kWh)}}{\text{Duration (min)} / 60}$$

### 6. Vehicle-Specific 3D Perspective KPI Cards (7 Cards)
1. **Total Sessions**: Lifetime recorded charging visits for the vehicle.
2. **Total Energy Delivered**: Sum of all recorded kWh dispensed to the vehicle.
3. **Avg Charging Duration**: Mean session time (in minutes/hours), filtering negative anomalies.
4. **Avg Calculated Power**: Mean transfer rate in kW calculated from actual physics data.
5. **Primary Charger Standard**: Distribution preference (Slow AC vs Fast DC).
6. **Distinct Stations Visited**: Unique charging physical locations utilized.
7. **Latest Recorded Session**: Timestamp and station location of most recent event.

### 7. Interactive Session Timeline Track
- Horizontal scrollable timeline displaying every recorded session chip for the selected vehicle.
- Displays Session Number, Date, Charger Type badge (AC/DC), Energy (kWh), and Duration.
- Clicking any session chip immediately loads that historical session into the 3D car studio and triggers the playback simulation.

### 8. Vehicle Analytics D3 Visualizations
- **Session Energy History Chart**: D3 line and gradient area chart tracking kWh delivered per session with interactive point tooltips.
- **Duration vs. Calculated Power Chart**: Dual-axis or scatter chart contrasting session length against delivered power.
- **Charger Type Preference**: D3 donut chart displaying the vehicle's personal ratio of Slow AC vs Fast DC usage.
- **Frequent Locations Visited**: D3 bar chart illustrating top venue categories (corporate, shopping, hotel, residential) frequented by the driver.

### 9. Bridge to 3D Campus ("Locate in 3D Campus")
- Clicking the **"Locate in 3D Campus"** button on any active session automatically glides the camera down into the large 3D Dual-Hub Campus, highlights the exact charger bay where that session took place, pulses an illuminated marker ring, and opens the station hologram.

---

## ⚡ Large 3D Dual-Hub Charging Campus (Three.js WebGL)

The platform also maintains the expansive **3D Charging Campus Digital Twin**:

- **Dual-Hub Architecture**:
  - **West Wing: Slow AC Plaza (Hub Alpha)**: Dedicated zone representing Level 2 charging infrastructure (**1,129 stations** in the dataset). Features **Electric Green (`#39FF88`)** stall lines, charging pedestals with illuminated green LED crowns, and an overhead glass canopy with a glowing green neon header.
  - **East Wing: Fast DC Superhub (Hub Beta)**: Dedicated zone representing high-power DC rapid charging infrastructure (**990 stations** in the dataset). Features **Amber Orange (`#FF9F43`)** stall lines, heavy-duty rapid dispensers with illuminated amber LED crowns, and an overhead glass canopy with an amber neon header.
  - **Central Transit Boulevard**: Central asphalt roadway (`#080c14`) with painted double cyan divider lines separating the two plazas.
- **Data-Driven Station Mapping**:
  - Total represented infrastructure: **2,119 distinct hardware chargers**.
  - Dynamic 3D charging bays with parking stall boundaries, wheel stop curbs, and distinct pedestal geometry.
- **Interactive Raycasting & Camera Controls**:
  - **Hover**: Real-time raycaster detects hovered pillars and displays a 3D hover tag with Station ID, Type, Location, and Session Count.
  - **Click-to-Select**: Smooth camera glide to the selected station, opening the **Station Telemetry Hologram Panel** displaying real dataset attributes.
  - **1-Click Filter**: Button inside the hologram to filter the entire dashboard to the selected station.
  - **Camera View Modes**:
    - **Campus Overview**: Isometric angled view showing both hubs and the central transit road.
    - **🔌 Slow AC Hub**: Smooth glide and zoom into the West Plaza.
    - **⚡ Fast DC Hub**: Smooth glide and zoom into the East Superhub.
    - **Station Focus**: Close-up inspection of the selected station.
    - **Aerial Map**: Top-down orthogonal campus layout.
    - **Reset Camera**: Restores default isometric perspective.
    - **Auto-Orbit**: Continuous cinematic orbit around the campus.

---

## 📊 Comprehensive D3.js Campus Visualizations & Analytics

All visualizations are driven by the real **72,856 charging records** in `data/ChargingRecords.csv`:

1. **Temporal Usage Time Series**: D3 line and area chart with smooth cubic monotonic curves, subtle glowing area gradients, Day/Month granularity switcher, and interactive bisector crosshairs.
2. **Charger Standard Bar Chart**: High-contrast bars comparing Slow AC (Electric Green) vs Fast DC (Amber Orange) volume with rounded corners and percentage annotations.
3. **AC vs DC Donut Distribution**: Donut chart with smooth arc expansion on hover, center total readout, and interactive slice click-to-filter.
4. **Duration vs Energy Demand Scatter Plot**: Scatter visualization supporting point sampling (2,000 / 5,000 / 10,000 / 72,856), linear regression trendline calculation (in Neon Pink `#F472B6`), and live Pearson $r$ correlation coefficient.
5. **Day × Hour Intensity Heatmap**: 7-day $\times$ 24-hour activity matrix with an inferno cyber-heat color ramp and tooltip statistics.
6. **Top 20 Stations Ranking**: Horizontal leaderboard showing highest-throughput chargers; clicking any bar focuses that station in the 3D hub.
7. **Station Matrix Activity Table**: Paginated/scrollable table featuring real-time search filtering across Station ID, Location, and Charger Type.
8. **Location Category Distribution**: Horizontal distribution chart mapping charging sessions across hotels, resorts, public hubs, corporate sites, etc.

---

## 🔍 Data Source & Engineering Notes

- **Source File**: `data/ChargingRecords.csv` (72,856 records).
- **Column Schema**:
  - `StationID`: Unique identifier for physical charging station.
  - `Location`: Venue name or address.
  - `ChargerType`: `0` for Slow AC (Level 2), `1` for Fast DC (Rapid).
  - `StartTime` / `EndTime`: Session start and completion timestamps.
  - `Duration`: Session duration in minutes (cleansed for negative values in power equations).
  - `Demand`: Energy delivered during session in kWh.
  - `UserID`: Unique vehicle/driver account ID. Mapped to **Vehicle ID** (2,337 unique drivers).
- **Physical Modeling Notes**:
  - Vehicle makes/models are not recorded in the original CSV schema; per project specifications, a modern aerodynamic electric sedan 3D model is rendered and explicitly labeled as an illustrative visual playback model.
  - Charging playback is calibrated to the real recorded session duration and energy delivered.

---

## 🚀 How to Launch the Dashboard

### Option 1: VS Code Live Server (Recommended)
1. Open the project folder `EV-Charging-Station-Analysis` in **VS Code**.
2. Right-click on `index.html` and select **"Open with Live Server"**.
3. The dashboard will automatically open in your default browser at `http://127.0.0.1:5500/index.html`.

### Option 2: Python Built-in HTTP Server
In your terminal or PowerShell within the project directory:
```bash
python -m http.server 8000
```
Then navigate to: `http://localhost:8000/index.html`.

---

## 👨‍💻 Project Submission Info
- **Project**: EV Charging Station Analysis — 3D Dual-Hub Campus & Electric Vehicle Telemetry Platform
- **Course**: CSE221 – Interactive Data Visualization
- **Core Technologies**: D3.js v7, Three.js r128, OrbitControls, Vanilla HTML5 / Modern CSS Grid & Flexbox
