# ฿ SET Thailand Stock Analyzer

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A powerful, lightweight Chrome extension for real-time analysis of stocks on the **Stock Exchange of Thailand (SET)**. Get instant access to financial KPIs, interactive charts, and shareholder data directly from your browser.

---

## ✨ Features

- **🚀 Real-Time Data**: Fetches live data directly from `set.or.th` with zero latency.
- **📊 Interactive Charts**: Custom SVG-based intraday price charts with hover tooltips.
- **💎 Financial KPIs**: Deep dive into P/E, P/BV, EPS, Dividend Yield, ROE, ROA, and more.
- **👥 Shareholder Insights**: Visualize major shareholders with distribution bars.
- **🕒 Historical Data**: View OHLCV (Open, High, Low, Close, Volume) table for the last 20 trading days.
- **🏢 Company Profile**: Detailed business descriptions, sector, industry, and contact info.
- **🛠 Activity Log**: Built-in developer console to track API requests and responses in real-time.
- **💾 Persistence**: Automatically remembers your last searched symbol.

---

## 📸 Screenshots

| Dashboard | Financials | Shareholders |
| :---: | :---: | :---: |
| ![Dashboard Placeholder](https://via.placeholder.com/200x300?text=Dashboard) | ![Financials Placeholder](https://via.placeholder.com/200x300?text=Financials) | ![Shareholders Placeholder](https://via.placeholder.com/200x300?text=Shareholders) |

---

## 🛠 Tech Stack

- **Manifest V3**: Using the latest Chrome extension standards.
- **Vanilla JavaScript**: Zero dependencies for the core logic, ensuring maximum performance.
- **Chart.js**: Powering the data visualization.
- **CSS Grid/Flexbox**: Modern, responsive layout designed for a compact popup.

---

## 🚀 Installation (Developer Mode)

1. **Clone or Download** this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click the **Load unpacked** button.
5. Select the `set-extension` folder from your local machine.
6. Click the **฿ icon** in your toolbar to start analyzing!

---

## 📖 Usage

1. Click the extension icon in your toolbar.
2. Enter a SET symbol (e.g., `TOP`, `PTT`, `KBANK`) or click one of the quick-access chips.
3. Switch between tabs:
    - **Chart**: Intraday price movement.
    - **Financials**: Key performance indicators and ratios.
    - **Holders**: Major shareholders list.
    - **History**: Recent trading history.
    - **Profile**: Company overview.
    - **Debug**: Raw API response logs.

---

## 🔒 Privacy & Security

- **No Tracking**: We do not collect or track any user data.
- **Direct Requests**: All API calls are made directly from your browser to `set.or.th`.
- **Local Storage**: Symbols are only stored locally in your Chrome profile.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
