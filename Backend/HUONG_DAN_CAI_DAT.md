Chào bạn! Để giúp bạn không bị "lạc" trong đống file, tôi đã ví hệ thống này như một **Nhà Hàng**. Bạn hãy đọc sơ đồ dưới đây để biết từng file đóng vai trò gì nhé!

> [!IMPORTANT]
> **LƯU Ý "SỐNG CÒN" TRƯỚC KHI DEPLOY (CHẠY ./deploy.sh)**
> Nếu bạn đang dùng chế độ "Phòng thí nghiệm" (chạy code ở máy Mac lấy dữ liệu VPS), hãy nhớ:
>
> 1. Mở file `.env` trên máy Mac.
> 2. Sửa `DB_HOST=103.75.186.186` thành **`DB_HOST=localhost`**.
> 3. Sau đó mới chạy `./deploy.sh`.
>    _(Việc này giúp ông đầu bếp trên VPS tìm thấy cái kho ngay cạnh mình, thay vì phải đi vòng ra internet tìm chính mình, giúp web chạy nhanh và ổn định hơn)._

---

## 🗺️ SƠ ĐỒ "NHÀ HÀNG" (Ý nghĩa các file - Rất dễ hiểu)

| Tên File                | Ví dụ gần gũi             | Chức năng chính                                                                                                                  |
| :---------------------- | :------------------------ | :------------------------------------------------------------------------------------------------------------------------------- |
| **`server.js`**         | **Đầu bếp chính** 👨‍🍳      | Đây là file quan trọng nhất. Nó nhận yêu cầu từ khách, chui vào kho lấy dữ liệu và nấu thành "món ăn" (kết quả) gửi lại cho web. |
| **`.env`**              | **Sổ tay bí mật** 📓      | Chứa các thông tin cực kỳ nhạy cảm như Mật khẩu két sắt (Database password). Tuyệt đối không để lộ file này!                     |
| **`index.html`**        | **Mặt tiền nhà hàng** 🏛️  | Là trang chủ mà bất kỳ ai cũng nhìn thấy đầu tiên. Nó đẹp hay xấu là ở đây.                                                      |
| **`Kyluat/`** (Thư mục) | **Phòng VIP quản lý** 🔑  | Chứa các trang Admin 0, 1, 2, 3, 4. Chỉ người có "chìa khóa" (tài khoản) mới vào được đây.                                       |
| **`schema.sql`**        | **Bản vẽ xây kho** 📐     | Dùng để tạo ra các "ngăn kệ" (bảng) trong Database lúc bạn mới cài máy chủ. Chỉ dùng 1 lần duy nhất lúc mới cài.                 |
| **`deploy.sh`**         | **Xe tải vận chuyển** 🚚  | Giúp bạn "bê" toàn bộ code từ máy Mac của mình ném lên VPS chỉ bằng 1 lệnh duy nhất.                                             |
| **`student_data.js`**   | **Danh sách dự phòng** 📄 | Bản danh sách tên học sinh viết trên giấy. Dùng để dự phòng hoặc nạp nhanh vào máy tính lúc ban đầu.                             |
| **`package.json`**      | **Danh sách đi chợ** 🛒   | Liệt kê các "nguyên liệu" (thư viện) cần thiết để ông Đầu bếp `server.js` có thể nấu ăn được.                                    |

---

## 🔑 PHẦN 0: PHÂN BIỆT 2 LOẠI MẬT KHẨU (CỰC KỲ QUAN TRỌNG)

Trước khi bắt đầu, bạn phải phân biệt rõ 2 loại "chìa khóa" sau để không bị nhầm lẫn:

1.  **Mật khẩu VPS (Chìa khóa Cổng - iNet cấp)**:
    - Là mật khẩu iNet gửi cho bạn khi mua VPS.
    - Dùng để bạn đăng nhập vào màn hình đen Terminal.
2.  **Mật khẩu Database (Chìa khóa Két sắt - Bạn tự đặt)**:
    - Là mật khẩu bạn sẽ tự gõ vào ở **Giai đoạn 1 - Bước 3** bên dưới.
    - Dùng để code chui vào lấy dữ liệu. Bạn phải điền mật khẩu này vào file `.env` trên máy Mac.

---

## 🏗️ GIAI ĐOẠN 1: Chuẩn Bị "Nhà Mới" (Làm trên VPS mới)

Mở Terminal trên máy Mac, gõ `ssh root@IP_CUA_BAN` để vào máy chủ mới, sau đó dán từng lệnh này:

### Bước 1: Cập nhật hệ thống

```bash
apt update && apt upgrade -y
```

### Bước 2: Cài đặt Node.js (Động cơ chạy web)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
```

### Bước 3: Cài đặt Database & Đặt mật khẩu

Dán lệnh này để cài:

```bash
apt install -y mariadb-server
```

Sau đó dán lệnh này để đặt mật khẩu (Chìa khóa két sắt):

```bash
mysql_secure_installation
```

_(Hệ thống hỏi gì cứ gõ **Y**, sau đó nó bảo nhập mật khẩu thì bạn tự nghĩ ra 1 cái rồi gõ vào. Ghi nhớ password này!)_

### Bước 4: Cài đặt PM2 (Người canh gác)

```bash
npm install pm2 -g
```

---

## 🗄️ GIAI ĐOẠN 2: Tạo "Kho Dữ Liệu" (Làm trên VPS mới)

Bạn cần tạo một cái kho tên là `school_discipline`:

1. Gõ: `mysql -u root -p` (nhập mật khẩu bạn vừa đặt ở Bước 3 trên).
2. Khi thấy dấu `->` hiện ra, gõ (hoặc dán) đúng dòng này:
   ```sql
   CREATE DATABASE school_discipline;
   EXIT;
   ```

---

## 🚚 GIAI ĐOẠN 3: Chuyển Code Lên (Làm trên máy Mac)

### Bước 1: Sửa file `deploy.sh`

- Mở file bằng phần mềm Text: Đổi `VPS_IP` thành IP mới, `VPS_PORT` thành cổng iNet cho (thường là 22 hoặc 24700).

### Bước 2: Sửa file `.env` (Quan trọng!)

- Mở file `.env`: Tại dòng `DB_PASSWORD=...`, hãy điền đúng **Mật khẩu Database** bạn đã tự đặt ở Giai đoạn 1.

### Bước 3: Làm sạch dữ liệu trường cũ

- Mở file `student_data.js`, xóa hết danh sách học sinh cũ, chỉ để lại: `const STATIC_STUDENTS = [];`.

### Bước 4: Chạy lệnh nạp code

Mở Terminal trên máy Mac tại thư mục dự án và gõ:

```bash
./deploy.sh
```

---

## 📈 GIAI ĐOẠN 4: Nạp Học Sinh Mới (Làm trên VPS mới)

Sau khi code đã lên VPS mới, bạn dán lệnh này ở VPS mới để nạp danh sách học sinh (nếu bạn đã điền tên vào file student_data.js trước khi deploy):

```bash
node migrate_data.js
```

---

## 🌐 GIAI ĐOẠN 5: Gắn Tên Miền (Domain) & Bật Ổ Khóa Xanh (SSL)

Bình thường bạn vào web qua IP nhìn rất khó nhớ. Để dùng tên miền như `renluyen.org`, bạn làm theo 2 bước:

### Bước 1: Trỏ tên miền về VPS (Làm trên trang iNet - Như ảnh bạn gửi)

Dựa vào hình ảnh bạn gửi, hãy làm theo đúng 3 bước này:

1.  Nhấn nút xanh **[+ Thêm bản ghi]** ở góc phải.
2.  Điền các ô như sau:
    - **Tên bản ghi**: Nhập dấu `@`
    - **Loại bản ghi**: Chọn `A`
    - **Giá trị bản ghi**: Nhập `103.75.186.186`
3.  Nhấn **Lưu** (biểu tượng dấu tích xanh).
    _(Lưu ý: Nếu đã có bản ghi nào tên là `@`, bạn hãy xóa bản ghi cũ đi trước khi thêm cái mới này)._

### Bước 2: Cài Nginx làm "Lễ tân" (Làm trên VPS mới)

Vì web của bạn đang chạy ở "tầng 3000" (Cổng 3000), khách hàng gõ tên miền sẽ không tìm thấy. Bạn cần một ông **Lễ tân (Nginx)** đứng ở sảnh chính để chỉ đường.

1.  Cài Nginx:
    ```bash
    apt install nginx -y
    ```
2.  Cài "Ổ khóa xanh" (SSL) để web có chữ `https` và hình ổ khóa:
    ```bash
    apt install certbot python3-certbot-nginx -y
    certbot --nginx -d renluyen.org
    ```
    _(Hệ thống sẽ hỏi Email và bắt bạn chọn **Y/N**, cứ chọn **Y**. Sau khi xong, web của bạn sẽ cực kỳ chuyên nghiệp với ổ khóa bảo mật)._

---

## 💻 GIAI ĐOẠN 6: Tiếp Tục Làm Việc Sau Khi Tắt Máy Tính

Khi bạn tắt máy Mac và hôm sau mở lại, web của bạn **vẫn chạy 24/7** trên VPS. Nếu bạn muốn vào lại máy chủ để sửa gì đó hoặc nạp code mới, hãy làm 3 bước này:

1.  **Mở Terminal** trên máy Mac.
2.  **Đăng nhập lại**: Gõ lệnh `ssh root@IP_CUA_BAN -p PORT` (Đây là bước "bước chân vào cửa" lại).
3.  **Làm việc**: Bạn có thể tiếp tục dán lệnh hoặc chạy `./deploy.sh` từ máy Mac như bình thường.

_(Lưu ý: Mọi thứ bạn đã cài ở Giai đoạn 1 & 2 đều đã được máy chủ ghi nhớ mãi mãi, bạn không bao giờ phải cài lại lần 2)._

---

## 📝 CÁC GHI CHÚ "VÀNG" (Rất quan trọng)

| Trường hợp                              | Cách xử lý                                                                                                               |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| **Vào web báo lỗi 404**                 | Hãy kiểm tra xem bạn có đang gõ dư chữ `www` không. Nếu gõ `renluyen.org` thì sẽ vào được ngay.                          |
| **Vừa trỏ iNet xong mà không vào được** | Đó là do "Độ trễ internet". **Cách xử lý**: Dùng điện thoại tắt Wifi, dùng 4G để vào. Hoặc đợi 30 phút cho mạng ổn định. |
| **Web bị đứng, không nạp được dữ liệu** | Đăng nhập vào VPS, dán lệnh: `pm2 restart school-web` để khởi động lại "Đầu bếp".                                        |
| **Muốn đổi mật khẩu Admin 0**           | Hãy nhờ tôi hỗ trợ sửa trong Database để đảm bảo an toàn.                                                                |

---

## ❓ NHỮNG CÂU HỎI THƯỜNG GẶP (FAQ)

### 1. Sau này tôi sửa giao diện (Frontend) thì có cần chạy lại `schema.sql` không?

**KHÔNG**.

- Hãy tưởng tượng `schema.sql` là **Cái khung xương** của ngôi nhà, còn Frontend là **Màu sơn**. Bạn thay đổi màu sơn, trang trí lại phòng khách thì không cần phải xây lại khung xương.
- Bạn chỉ cần chạy `deploy.sh` là xong.

### 2. Khi nào thì mới cần đụng vào `schema.sql`?

Chỉ khi bạn thay đổi **Cấu trúc dữ liệu**. Ví dụ:

- Bạn muốn thêm một cột "Số điện thoại phụ huynh" cho học sinh.
- Bạn muốn thêm một bảng mới để quản lý "Điểm danh".
- Lúc này mới cần sửa file SQL. Nhưng lời khuyên là hãy nhờ tôi hỗ trợ phần này để tránh làm mất dữ liệu cũ của trường.

### 3. File này giải nén trên VPS rồi chạy như thế nào?

File này không "chạy" như một phần mềm. Nó là một **Tờ hướng dẫn**.

- Code của bạn (vùng Giai đoạn 3) khi được giải nén trên VPS sẽ tự chui vào thư mục `/root/`.
- Để thực hiện "lệnh" trong file này, bạn dùng câu lệnh thần chú:
  ```bash
  mysql -u root -p school_discipline < schema.sql
  ```
  _(Nghĩa là: Lấy những gì viết trong file `schema.sql` rồi "đổ" hết vào cái hòm `school_discipline`)_.

> [!CAUTION]
> **CẢNH BÁO QUAN TRỌNG**: Đừng bao giờ chạy lại file này khi trường đã đang sử dụng web và đã có dữ liệu thật, trừ khi bạn thực sự biết mình đang làm gì. Việc chạy lại sai cách có thể làm "reset" toàn bộ điểm số của học sinh về 0 đấy!

### 4. Nếu tôi muốn bổ sung thêm thông tin (vd: thêm số điện thoại) thì có phải "Cài lại" khung xương không?

**KHÔNG CẦN CÀI LẠI**.

- Trong nghề code, chúng tôi gọi đây là **Nâng cấp** (Migration).
- Bạn hãy tưởng tượng: Ngôi nhà đang có 2 phòng, bạn muốn xây thêm 1 phòng nữa. Bạn chỉ cần xây thêm vào, chứ không cần ủi phẳng cả ngôi nhà đi để xây lại từ đầu.
- **Cách làm**: Tôi sẽ gửi cho bạn một câu lệnh ngắn (vd: `ALTER TABLE...`). Bạn chỉ cần dán lệnh đó vào Terminal. Nó sẽ tự "nới" thêm một ngăn kệ trong kho dữ liệu mà không làm rơi bất kỳ vật dụng nào đang có sẵn.

### 5. Khung xương có chứa dữ liệu (Điểm số, Tên học sinh) không?

- **File `schema.sql`**: Chỉ là **Bản vẽ**. Nó không chứa dữ liệu thật của khách hàng.
- **Phần mềm Database (MariaDB)**: Đây mới là **Cái kho thật** đang chạy trên VPS. Nó ghi nhớ toàn bộ những gì khách hàng nhập vào.
- **Mối quan hệ**: Khi bạn chạy file `schema.sql` lần đầu, nó sẽ tạo ra cái kho trống. Sau đó, khách hàng nhập dữ liệu vào, dữ liệu đó sẽ nằm an toàn trong cái kho trên VPS, chứ không chui ngược lại vào file `schema.sql` của bạn đâu.

---

> [!TIP]
> **Tóm lại**: File `schema.sql` là để khởi tạo "nhà mới" cho "khách mới". Còn muốn sửa chữa, nâng cấp cho "khách cũ" thì chúng ta dùng lệnh "sửa chữa" (nâng cấp) chứ không dùng lệnh "xây lại" nhé!

> [!IMPORTANT]
> **MẸO NHỎ**: Để không bao giờ bị nhầm, khi cài VPS mới, ở bước đặt mật khẩu Database, bạn có thể đặt **Y HỆT** mật khẩu VPS mà iNet cấp. Như vậy bạn chỉ cần nhớ 1 mật khẩu duy nhất cho cả "Cổng" và "Két sắt"!
