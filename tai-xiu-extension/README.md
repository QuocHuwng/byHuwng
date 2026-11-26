# byHuwng – Probability & Statistical Analyzer

**byHuwng** là tiện ích mở rộng (Chrome Extension Manifest V3) chuyên nghiệp dùng để tính toán, mô phỏng và phân tích xác suất trò chơi Tài Xỉu 3 viên xúc xắc (Sic Bo).

Tiện ích hoạt động **100% độc lập trên máy tính (offline)**, không cần backend server, không thu thập hay truyền tải dữ liệu người dùng ra bên ngoài, đảm bảo an toàn và bảo mật dữ liệu tuyệt đối.

---

## 🌟 Tính Năng Nổi Bật

### 1. Bảng Điều Khiển Xác Suất Động (Không Hardcode)
- **TÀI (Tổng 11 – 17, không tính bộ ba):** 105 / 216 tổ hợp = **48,61%**
- **XỈU (Tổng 4 – 10, không tính bộ ba):** 105 / 216 tổ hợp = **48,61%**
- **BỘ BA ĐỒNG NHẤT (1-1-1 đến 6-6-6):** 6 / 216 tổ hợp = **2,78%**
- **Tổng không gian mẫu:** 6³ = **216 tổ hợp độc lập**
- Toàn bộ xác suất được tính bằng thuật toán tổ hợp thực tế (Combinatorics Engine) duyệt động qua toàn bộ không gian biến cố, không gán cứng kết quả.

### 2. Công Cụ Phân Tích & "Soi Cầu" Thống Kê
- **Phân phối điểm tổng từ 3 đến 18:** Biểu đồ trực quan so sánh tần suất thực tế và đường cong phân phối lý thuyết.
- **Nhận diện cầu tự động:**
  - *Cầu Bệt:* Chuỗi liên tiếp từ 3 phiên cùng kết quả trở lên.
  - *Cầu Đảo (1-1):* Chuỗi xen kẽ Tài – Xỉu liên tục.
  - *Cầu 2-2:* Dạng cặp đôi đối xứng.
  - *Cầu 1-2 / 2-1:* Nhịp chuỗi đơn - đôi.
- **Thống kê theo cửa sổ linh hoạt:** Lọc dữ liệu theo 10, 20, 50, 100, 500 phiên gần nhất hoặc toàn bộ lịch sử.
- **Khoảng tin cậy Wilson 95% (Wilson Score Confidence Interval)** và kiểm định $Z$-score đánh giá độ lệch thực tế so với kỳ vọng lý thuyết.
- **Bảng Cầu Giọt Nước (Casino Bead Road):** Trực quan hóa chuỗi phiên theo phong cách casino hiện đại.

### 3. Bộ Máy Mô Phỏng Monte Carlo Siêu Tốc
- Hỗ trợ mô phỏng từ **1.000 đến 1.000.000 lượt gieo** ngẫu nhiên.
- Tốc độ tối ưu hóa cực cao: **1.000.000 lượt hoàn thành dưới 50ms**.
- Đánh giá độ hội tụ theo Luật số lớn (Law of Large Numbers) và kiểm định Chi-Square ($\chi^2$ Goodness-of-Fit test).

### 4. Nhập Liệu & Quản Lý Dữ Liệu
- Bộ chọn 3 xúc xắc 3D tương tác trực tiếp (nhấp xúc xắc để đổi mặt 1–6 hoặc dùng nút +/-).
- Tự động phân loại Tài, Xỉu, Bộ ba, Chẵn, Lẻ, Cặp đôi.
- Phím tắt gieo ngẫu nhiên và nhập nhanh (+1 Tài, +1 Xỉu, +1 Bộ ba).
- Quản lý lịch sử chi tiết: xem thời gian, xóa từng phiên hoặc xóa toàn bộ.
- **Xuất dữ liệu ra file CSV** chuẩn UTF-8 (mở tốt trên Excel).
- **Nhập dữ liệu từ file CSV** nhanh chóng.
- Nút nạp 50 phiên mẫu ngẫu nhiên để trải nghiệm ngay lập tức.

### 5. Giao Diện Casino Analytics Dark Mode
- Tông màu đen obsidian sang trọng, viền vàng gold, điểm nhấn đỏ ruby (Tài) và xanh emerald (Xỉu).
- Kích thước chuẩn 420 × 650 px, không xuất hiện thanh cuộn ngang.
- Hỗ trợ chuyển đổi nhanh giữa chế độ Thu gọn (420px) và Mở rộng (680px) hoặc mở trong tab trình duyệt riêng biệt.

### 6. Khoa Học Xác Suất & Cảnh Báo "Ngụy Biện Con Bạc"
- Phân biệt rõ ràng giữa **Xác suất lý thuyết**, **Tần suất lịch sử**, và **Khoảng tin cậy**.
- Khẳng định nguyên lý độc lập: Mỗi phiên gieo xúc xắc là một biến cố độc lập hoàn toàn ($P(A \cap B) = P(A) \cdot P(B)$). Xúc xắc không có bộ nhớ, không có bất kỳ hệ thống soi cầu nào có thể dự đoán chắc chắn kết quả tiếp theo.

---

## 📁 Cấu Trúc Thư Mục

```
tai-xiu-extension/
├── manifest.json                  # Cấu hình Chrome Extension Manifest V3
├── popup.html                     # Giao diện chính của tiện ích
├── popup.css                      # Phong cách Casino Analytics Dark Mode
├── popup.js                       # Xử lý tương tác, biểu đồ SVG, dữ liệu
├── background.js                  # Service Worker Manifest V3
├── package.json                   # Cấu hình dự án & Unit tests
├── core/
│   ├── probability.js             # Bộ máy tính xác suất & tổ hợp 216 trạng thái
│   ├── simulation.js              # Bộ máy mô phỏng Monte Carlo 1.000.000 lượt
│   ├── statistics.js              # Thống kê Wilson CI, Z-score, chuỗi, Markov
│   └── analyzer.js                # Nhận diện cầu, phân tích cửa sổ, tổng hợp
├── assets/
│   └── icons/
│       ├── icon16.png             # Icon 16x16
│       ├── icon48.png             # Icon 48x48
│       └── icon128.png            # Icon 128x128
├── tests/
│   └── test_calculations.test.js  # Bộ kiểm thử Unit Test cho các thuật toán
└── README.md                      # Hướng dẫn chi tiết sử dụng & cài đặt
```

---

## 🚀 Hướng Dẫn Cài Đặt Lên Trình Duyệt

Tiện ích được phát triển theo chuẩn **Manifest V3**, tương thích hoàn toàn với **Google Chrome**, **Microsoft Edge**, **Brave**, **Cốc Cốc** và các trình duyệt nền Chromium.

### Cách 1: Cài đặt trên Google Chrome
1. Mở Google Chrome, nhập vào thanh địa chỉ:
   ```
   chrome://extensions
   ```
2. Ở góc trên bên phải màn hình, bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)**.
3. Nhấp vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
4. Điều hướng và chọn thư mục:
   ```
   c:\Users\admin\Desktop\tx\tai-xiu-extension
   ```
5. Tiện ích **TAI XIU PRO – Probability Analyzer** sẽ xuất hiện trên danh sách.
6. Nhấp vào biểu tượng mảnh ghép (Extensions) trên thanh công cụ của Chrome, sau đó ghim (Pin) **TAI XIU PRO** để tiện sử dụng.

### Cách 2: Cài đặt trên Microsoft Edge
1. Mở Microsoft Edge, nhập vào thanh địa chỉ:
   ```
   edge://extensions
   ```
2. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc dưới bên trái menu.
3. Nhấp vào nút **Tải phần mở rộng chưa được đóng gói (Load unpacked)**.
4. Chọn thư mục `c:\Users\admin\Desktop\tx\tai-xiu-extension`.
5. Ghim tiện ích lên thanh công cụ để mở nhanh bất cứ lúc nào.

---

## 🧪 Chạy Kiểm Thử (Unit Tests)

Dự án tích hợp sẵn bộ kiểm thử toán học toàn diện sử dụng Node.js Test Runner:

```bash
cd c:\Users\admin\Desktop\tx\tai-xiu-extension
npm test
# hoặc
node --test tests/test_calculations.test.js
```

### Kết quả kiểm thử:
- ✅ **Sample Space:** Đảm bảo chính xác 216 tổ hợp độc lập.
- ✅ **Lý thuyết:** Xác nhận 105 Tài (48.61%), 105 Xỉu (48.61%), 6 Bộ ba (2.78%).
- ✅ **Phân loại xúc xắc:** Kiểm tra tính chính xác của bộ ba, cặp đôi, tổng điểm.
- ✅ **Monte Carlo:** Xác thực tốc độ và tính hội tụ chuẩn.
- ✅ **Khoảng tin cậy Wilson:** Xác minh tính chính xác của khoảng tin cậy 95%.
- ✅ **Nhận diện cầu:** Kiểm tra thuật toán phát hiện Cầu Bệt, Cầu Đảo 1-1, Cầu 2-2.

---

## 📖 Hướng Dẫn Sử Dụng Chi Tiết

1. **Gieo & Nhập Phiên (Tab 1):**
   - Chọn số điểm của 3 viên xúc xắc bằng cách nhấp trực tiếp vào mặt xúc xắc hoặc nhấn nút `+` / `-`.
   - Bấm **➕ Lưu Phiên Này** để ghi nhận vào lịch sử.
   - Hoặc bấm **🎲 Gieo Ngẫu Nhiên** để mô phỏng xúc xắc thật.
   - Hoặc sử dụng các nút **⚡ +1 TÀI**, **⚡ +1 XỈU**, **⚡ +1 BỘ BA** để nhập nhanh.
   - Quan sát dải Cầu Giọt Nước phía dưới để theo dõi xu hướng gần đây.

2. **Phân Tích Cầu & Xu Hướng (Tab 2):**
   - Chọn khung phiên cần phân tích (10, 20, 50, 100, 500 hoặc Tất cả).
   - Xem loại cầu hiện tại do thuật toán tự động nhận diện.
   - Xem bảng so sánh giữa tần suất thực tế và xác suất lý thuyết kèm khoảng tin cậy 95%.
   - Biểu đồ hình cột hiển thị phân phối điểm tổng 3–18 kèm đường lý thuyết mẫu.

3. **Mô Phỏng Monte Carlo (Tab 3):**
   - Chọn số lượng lượt muốn thử nghiệm: 1.000 đến 1.000.000 lượt.
   - Bấm **🚀 Bắt Đầu Mô Phỏng Ngay**. Kết quả tính toán sẽ trả về ngay lập tức kèm thời gian thực thi (ms) và bảng phân phối chi tiết.

4. **Lịch Sử & CSV (Tab 4):**
   - Xem lại danh sách tất cả các phiên đã gieo.
   - Bấm **📥 Xuất CSV** để tải file báo cáo lịch sử về máy tính.
   - Bấm **📤 Nhập CSV** để nạp dữ liệu phiên đã lưu từ trước.
   - Bấm **🎲 Nạp 50 Phiên Mẫu** để sinh ngay 50 phiên ngẫu nhiên giúp xem thử toàn bộ tính năng phân tích.

5. **Lý Thuyết & Khoa Học (Tab 5):**
   - Đọc các kiến thức cốt lõi về bản chất xác suất, tính độc lập của các phép thử ngẫu nhiên và giải thích chi tiết về sai lầm tâm lý "Ngụy biện con bạc".

---

## ⚖️ Giấy Phép & Khuyến Cáo

- Dự án phục vụ mục đích học thuật, nghiên cứu xác suất thống kê và giáo dục tư duy phản biện.
- Trò chơi có yếu tố ngẫu nhiên có lợi thế toán học thuộc về nhà cái (2,78% từ bộ ba). Tiện ích giúp người dùng hiểu rõ bản chất toán học để không bị dẫn dụ bởi các phương pháp soi cầu thiếu cơ sở khoa học.
- Mã nguồn mở phát hành theo giấy phép **MIT**.
