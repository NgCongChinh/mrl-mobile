// ---------------------------------------------------------------------------
// 09 Hệ thống Song Ngữ & Học Tiếng Anh Chuyên ngành Kỹ thuật (MRL / PLC / NET)
//   - Chuyển đổi toàn bộ Giao diện & Nội dung bài học: VI <-> EN (Phương án A)
//   - Quét chữ dịch tự động 2 chiều: VI -> EN và EN -> VI + Bóc tách thuật ngữ + Phát âm 🔊
//   - Chế độ đối chiếu Song ngữ từng khối & cả bài
//   - Gạch chân thuật ngữ 2 chiều + Tooltip khi rê chuột
//   - Sổ từ vựng & Flashcard / Quiz 4 đáp án
// ---------------------------------------------------------------------------

let _enCompiledRegex = null;
let _enCompiledMap = new Map();
let _enCompiledSig = '';
let _enEnglishRegex = null;
let _enEnglishMap = new Map();
let _enEnglishSig = '';
let _enHoverHideTimer = null;
let _enSelReqSeq = 0;
let _enLastSelectionPayload = null;
let _fullTransSeq = 0;
const _enRecordBilingualCache = {};
const _clientViToEnCache = new Map();
window._clientViToEnCache = _clientViToEnCache;

// ---- Bảng từ điển Giao diện Hệ thống (VI -> EN) ----
const UI_I18N_MAP = {
  'Chọn phân hệ làm việc': 'Select Engineering Workspace',
  'WORKBENCH · 3 PHÂN HỆ KỸ THUẬT ĐỘC LẬP': 'WORKBENCH · 3 INDEPENDENT ENGINEERING MODULES',
  'WORKBENCH · 4 PHÂN HỆ KỸ THUẬT ĐỘC LẬP': 'WORKBENCH · 4 INDEPENDENT ENGINEERING MODULES',
  'OPENQUIZ AI LAB': 'OPENQUIZ AI LAB',
  'THỐNG KÊ TIẾNG ANH KỸ THUẬT': 'ENGLISH HUB STATISTICS',
  'TỪ VỰNG & LEXICAL CHUNKS': 'VOCABULARY & LEXICAL CHUNKS',
  'BỘ ĐỀ QUIZ & ĐỌC HIỂU MANUAL': 'QUIZZES & MANUAL READING',
  'LUYỆN DỊCH & PHỎNG VẤN KỸ THUẬT': 'TRANSLATION & TECH INTERVIEW',
  'NỘI DUNG BÊN TRONG ENGLISH': 'ENGLISH HUB MODULES',
  'VÀO PHÂN HỆ ENGLISH →': 'OPEN ENGLISH HUB →',
  '+ Thêm Từ / Quiz': '+ Add Vocab / Quiz',
  'OpenQuiz AI (Trắc nghiệm & Điền từ)': 'OpenQuiz AI (MCQ & Cloze)',
  'Luyện dịch Kỹ thuật & Sửa ngữ pháp': 'Tech Translation & Grammar Coach',
  'Kho Từ vựng & Cụm từ (Lexical Chunks)': 'Vocab & Lexical Chunks Bank',
  'Ôn tập Flashcard Tiếng Anh': 'English Flashcard Drill',
  'Vở Nháp Tiếng Anh (Đọc dịch Manual)': 'English Scratchpad (Manual Reader)',
  'Luyện Tiếng Anh chuyên ngành Điện tử - Tự động hóa theo mô hình OpenQuizAI: Tạo đề trắc nghiệm tự động từ Manual/Ca bệnh, Điền khuyết cụm từ (Lexical Chunks), Luyện dịch & Sửa ngữ pháp AI.': 'Technical English Hub (OpenQuizAI model): Auto-generate MCQ/Cloze quizzes from Manuals & Fault Cases, Lexical Chunks, and 1-on-1 Grammar & Phrasing Coach.',
  'Mỗi phân hệ được tách riêng hoàn toàn dữ liệu, bộ lọc tra cứu, thống kê tiến độ và bộ thẻ ôn tập chuyên ngành.': 'Each module keeps its own records, filters, progress metrics, and active-recall flashcards.',
  'INDUSTRIAL ENGINEERING HUB': 'INDUSTRIAL ENGINEERING HUB',
  'Nhập Excel': 'Import Excel',
  'Xuất Excel': 'Export Excel',
  'Màn hình chính': 'Portal',
  '← Màn hình chính': '← Portal',
  '« Ẩn': '« Hide',
  '☰ Menu': '☰ Menu',
  '☰ Hiện menu': '☰ Menu',
  '× Đóng bớt': '× Close Tabs',
  '◫ Chia đôi': '◫ Split',
  '⬓ Trên/Dưới': '⬓ Top/Bottom',
  '⇄ Đổi bên': '⇄ Swap Panes',
  '× Đóng chia': '× Close Split',
  '← Danh sách (Esc)': '← List (Esc)',
  '← Danh sách': '← List',
  '☷ Hiện/Ẩn cột danh sách': '☷ Toggle List',
  '◫ Mở ở Khung 2': '◫ Pane 2',
  '🇬🇧 Song ngữ cả bài': '🇬🇧 Bilingual View',
  '🇬🇧 Song ngữ': '🇬🇧 Bilingual',
  '↑ Bài trước': '↑ Prev',
  '↓ Bài tiếp': '↓ Next',
  '↑ Từ trước': '↑ Prev Term',
  '↓ Từ tiếp': '↓ Next Term',
  '🎯 Ôn bài này': '🎯 Drill Note',
  'Sửa': 'Edit',
  'Xóa': 'Delete',
  'Sửa ghi chú': 'Edit Note',
  '✎ Viết / Sửa': '✎ Edit Block',
  'CHƯA GẮN MÃ': 'NO TAGS',
  'ĐÁNH DẤU': 'TAGGED',
  'Hủy': 'Cancel',
  'Đóng': 'Close',
  'Lưu thay đổi': 'Save Changes',
  'BẢO TRÌ & SỬA CHỮA': 'MAINTENANCE & REPAIR',
  'LẬP TRÌNH PLC': 'PLC PROGRAMMING',
  'INDUSTRIAL NETWORK': 'INDUSTRIAL NETWORK',
  'THỐNG KÊ HỆ THỐNG': 'STATISTICS',
  'THỐNG KÊ PHÂN HỆ MRL': 'MRL STATISTICS',
  'THỐNG KÊ PHÂN HỆ PLC': 'PLC STATISTICS',
  'THỐNG KÊ MẠNG TRUYỀN THÔNG': 'NETWORK STATISTICS',
  'NHÓM CHỦ ĐỀ PLC': 'PLC TOPICS',
  'CHUẨN GIAO THỨC': 'PROTOCOLS',
  'NHÓM TỪ VỰNG & CHUNKS': 'VOCAB & CHUNK GROUPS',
  'TẤT CẢ BÀI PLC': 'ALL PLC NOTES',
  'TẤT CẢ GIAO THỨC': 'ALL PROTOCOLS',
  'TẤT CẢ KHO TỪ': 'ALL VOCAB & CHUNKS',
  'TẤT CẢ THẺ MRL (CA SỬA + SOP)': 'ALL MRL CARDS (REPAIR + SOP)',
  'CHỈ CA SỬA CHỮA': 'REPAIR CASES ONLY',
  'CHỈ KIẾN THỨC & SOP': 'KNOWLEDGE & SOP ONLY',
  'TẤT CẢ BÀI LẬP TRÌNH PLC': 'ALL PLC NOTES',
  'TẤT CẢ CẤU HÌNH MẠNG': 'ALL NETWORK CONFIGS',
  'TẤT CẢ TỪ VỰNG & CHUNKS': 'ALL VOCAB & LEXICAL CHUNKS',
  'Tổng bản ghi MRL': 'Total MRL Records',
  'Ca sửa chữa': 'Repair Cases',
  'Ca sửa chữa thiết bị': 'Equipment Repair Cases',
  'Kiến thức & SOP': 'Knowledge & SOP',
  'Kiến thức & Quy trình SOP': 'Knowledge & SOP',
  'Linh kiện & mã lỗi': 'Components & Faults',
  'Linh kiện & Mã lỗi tra cứu': 'Components & Fault Codes',
  'Tổng bài PLC': 'Total PLC Notes',
  'Tổng cấu hình mạng': 'Total Network Notes',
  'Từ & Lexical Chunks': 'Vocab & Lexical Chunks',
  'Câu hỏi OpenQuiz': 'OpenQuiz Questions',
  'Đề luyện dịch 1-1': '1-on-1 Translation Prompts',
  'Đã làm chủ': 'Mastered',
  'Cần xem lại': 'Needs Review',
  'Đang nghiên cứu': 'Researching',
  'Chưa phân loại': 'Unclassified',
  'Làm chủ': 'Mastered',
  'Xem lại': 'Review',
  'Nghiên cứu': 'Research',
  'Nhật ký ca sửa chữa': 'Repair Case Log',
  'Ôn tập MRL': 'MRL Drill',
  'Ôn tập PLC': 'PLC Drill',
  'Ôn tập Mạng truyền thông': 'Network Drill',
  'Ôn tập Flashcard MRL': 'MRL Flashcard Drill',
  'Ôn tập Flashcard PLC': 'PLC Flashcard Drill',
  'Bài học & Khối hàm PLC': 'PLC Lessons & Blocks',
  'Giao thức & Thanh ghi': 'Protocols & Registers',
  'Vở Nháp ghi chú (MRL)': 'MRL Scratchpad',
  'Vở Nháp PLC (Viết & Dán ảnh)': 'PLC Scratchpad (Notes & Images)',
  'Vở Nháp Mạng (Viết & Dán ảnh)': 'Network Scratchpad',
  'Nháp': 'Scratchpad',
  'Luyện dịch & Ngữ pháp': 'Translation & Grammar',
  'Kho Từ & Lexical Chunks': 'Vocab & Lexical Chunks',
  'Flashcard Tiếng Anh': 'English Flashcards',
  'Vở Nháp Đọc Manual': 'Manual Reader Scratchpad',
  'NỘI DUNG BÊN TRONG MRL': 'MRL MODULES',
  'NỘI DUNG BÊN TRONG PLC': 'PLC MODULES',
  'NỘI DUNG BÊN TRONG NETWORK': 'NETWORK MODULES',
  'VÀO PHÂN HỆ MRL →': 'OPEN MRL →',
  'VÀO PHÂN HỆ PLC →': 'OPEN PLC →',
  'VÀO PHÂN HỆ NETWORK →': 'OPEN NETWORK →',
  '+ Ca sửa': '+ Repair',
  '+ Bài PLC': '+ PLC Note',
  '+ Cấu hình': '+ Network',
  '+ CA SỬA CHỮA': '+ NEW REPAIR',
  '+ KIẾN THỨC / SOP': '+ NEW KNOWLEDGE',
  '+ THÊM BÀI PLC MỚI': '+ NEW PLC NOTE',
  '+ THÊM CẤU HÌNH MẠNG': '+ NEW NETWORK',
  '+ THÊM TỪ / CHUNK': '+ ADD VOCAB / CHUNK',
  '+ Thêm Từ / Chunk': '+ Add Vocab / Chunk',
  '+ Thêm Từ / Lexical Chunk': '+ Add Vocab / Lexical Chunk',
  '⚡ TẠO QUIZ TỪ MANUAL': '⚡ QUIZ FROM MANUAL',
  '🔑 Gemini Key (OFFLINE)': '🔑 Gemini Key (OFFLINE)',
  '🔑 Gemini Key (ĐÃ BẬT AI)': '🔑 Gemini Key (AI ENABLED)',
  '🔑 Cấu hình Gemini API Key': '🔑 Gemini API Key Settings',
  '🔑 Cấu hình Gemini API Key (Offline)': '🔑 Gemini API Key (Offline)',
  '🔑 Gemini AI: ĐÃ BẬT': '🔑 Gemini AI: ENABLED',
  '+ Thêm ca sửa': '+ Add Repair',
  '+ Thêm kiến thức': '+ Add Knowledge',
  '+ Thêm bài PLC': '+ Add PLC Note',
  '+ Thêm mạng': '+ Add Network',
  '+ Thêm cấu hình mạng': '+ Add Network',
  '+ Thêm bước kiểm tra': '+ Add Check Step',
  '+ Thêm mục mới ngay tại đây (viết chữ · dán ảnh Ctrl+V)': '+ Add New Section Here (type notes · Ctrl+V paste image)',
  'Nhật ký ca sửa chữa biến tần, bo mạch, HMI, Servo; Kiến thức đo kiểm SOP & Từ điển linh kiện / mã lỗi.': 'Repair logs for VFD, PCBA, HMI & Servo; SOP diagnostics and component/fault code dictionary.',
  'Lập trình & Hệ thống PLC Siemens TIA Portal: khối hàm FB/FC/OB, vùng nhớ DB/UDT, Analog 4-20mA & PID, Đấu nối.': 'PLC Programming & TIA Portal: FB/FC/OB blocks, DB/UDT memory, 4-20mA Analog & PID, Physical Wiring.',
  'Mạng Truyền thông Công nghiệp: Modbus RTU/TCP, EtherCAT, CANbus/CANopen, Profibus/Profinet, đấu nối 120Ω & thanh ghi.': 'Industrial Networks: Modbus RTU/TCP, EtherCAT, CANbus/CANopen, Profibus/Profinet, 120Ω wiring & Register maps.',
  'DANH SÁCH CA BỆNH': 'REPAIR CASES',
  'DANH SÁCH CA SỬA CHỮA': 'REPAIR CASES',
  'DANH MỤC KIẾN THỨC & SOP': 'KNOWLEDGE & SOP LIST',
  'DANH SÁCH KIẾN THỨC & SOP': 'KNOWLEDGE & SOP',
  'LẬP TRÌNH & HỆ THỐNG PLC': 'PLC PROGRAMMING & SYSTEMS',
  'DANH SÁCH BÀI HỌC PLC': 'PLC NOTES',
  'MẠNG TRUYỀN THÔNG': 'INDUSTRIAL NETWORK',
  'DANH SÁCH CẤU HÌNH MẠNG': 'NETWORK NOTES',
  'KHO TỪ VỰNG & LEXICAL CHUNKS': 'VOCABULARY & LEXICAL CHUNKS',
  'TRA CỨU LIÊN KẾT CHÉO LINH KIỆN & MÃ LỖI (MRL)': 'COMPONENT & FAULT CROSS-REFERENCE (MRL)',
  'Chọn một mã để xem toàn bộ ca sửa chữa và kiến thức SOP liên quan trong phân hệ MRL.': 'Select a tag to inspect all related repair cases and SOP notes in MRL.',
  'DANH MỤC LINH KIỆN & IC': 'COMPONENTS & ICs',
  'DANH MỤC MÃ LỖI THIẾT BỊ': 'EQUIPMENT FAULT CODES',
  'Phân loại: tất cả': 'Category: All',
  'PHÂN LOẠI: TẤT CẢ': 'CATEGORY: ALL',
  'KHÔNG CÓ CA PHÙ HỢP': 'NO MATCHING REPAIR CASES',
  'KHÔNG CÓ TÀI LIỆU PHÙ HỢP': 'NO MATCHING DOCUMENTS',
  'KHÔNG CÓ BÀI PLC PHÙ HỢP': 'NO MATCHING PLC NOTES',
  'KHÔNG CÓ CẤU HÌNH MẠNG PHÙ HỢP': 'NO MATCHING NETWORK NOTES',
  'KHÔNG CÓ TỪ VỰNG PHÙ HỢP': 'NO MATCHING VOCABULARY',
  'CHƯA CHỌN CA BỆNH': 'NO CASE SELECTED',
  'CHƯA CHỌN TÀI LIỆU': 'NO ITEM SELECTED',
  'CHƯA CHỌN BÀI LẬP TRÌNH PLC': 'NO PLC NOTE SELECTED',
  'CHƯA CHỌN CẤU HÌNH MẠNG': 'NO NETWORK NOTE SELECTED',
  'CHƯA CHỌN TỪ VỰNG / CỤM TỪ': 'NO VOCAB / CHUNK SELECTED',
  'LƯU Ý CẤP NGUỒN TEST & CẤU HÌNH VẬN HÀNH': 'BENCH TEST POWER & CONFIG NOTES',
  'Hiện tượng / Điểm đo': 'Symptom / Test Point',
  'Nguyên nhân gốc rễ': 'Root Cause',
  'Cách xử lý & Linh kiện': 'Solution & Components',
  'TỪ KHÓA LÕI': 'KEY TAKEAWAY',
  'BẢN CHẤT NGUYÊN LÝ': 'CORE CONCEPT & PRINCIPLE',
  'CÂU HỎI PHẢN BIỆN (TẠI SAO?)': 'CRITICAL QUESTION (WHY?)',
  'TRẢ LỜI THỰC CHIẾN & GIẢI PHÁP': 'PRACTICAL ANSWER & SOLUTION',
  'ỨNG DỤNG THỰC CHIẾN': 'FIELD APPLICATION',
  'LƯU Ý AN TOÀN & THỰC HÀNH': 'SAFETY & LAB NOTES',
  'QUY TRÌNH ĐO & SỬA (SOP)': 'MEASUREMENT & REPAIR SOP',
  'CHÂN / THAM SỐ': 'PIN / PARAM',
  'CHIỀU': 'DIR',
  'KIỂU DỮ LIỆU': 'DATA TYPE',
  'MÔ TẢ CHỨC NĂNG': 'DESCRIPTION',
  'TÊN THANH GHI / LỆNH': 'REGISTER / CMD',
  'ĐỊA CHỈ HEX': 'HEX ADDR',
  'ĐỊA CHỈ DEC': 'DEC ADDR',
  'Ý NGHĨA & GIÁ TRỊ': 'MEANING & VALUES',
  'ÔN TẬP SÂU': 'DEEP DRILL',
  'Chế độ hỏi': 'Question Mode',
  'Lọc câu chưa thuộc': 'Unsolid Only',
  'Ô tự gõ': 'Recall Draft',
  'Trộn thẻ': 'Shuffle Deck',
  '← Thẻ trước': '← Prev Card',
  'Thẻ tiếp →': 'Next Card →',
  'Lật thẻ / Đối chiếu': 'Flip / Check Answer',
  'Lật thẻ / Xem đáp án': 'Flip / Show Answer',
  'Ẩn đáp án': 'Hide Answer',
  'Mở bài gốc ↗': 'Open Source ↗',
  'Reset bài': 'Reset Progress',
  'CHẤM MỨC ĐỘ NHỚ:': 'RECALL RATING:',
  '🔴 Quên · Hỏi lại [1]': '🔴 Forgot [1]',
  '🟡 Nhớ mờ [2]': '🟡 Fuzzy [2]',
  '🟢 Thuộc chắc [3]': '🟢 Solid [3]',
  '🟢 THUỘC CHẮC': '🟢 SOLID',
  '🟡 NHỚ MỜ': '🟡 FUZZY',
  '🔴 CẦN NHỚ LẠI': '🔴 NEEDS RECALL',
  '⚪ CHƯA ÔN': '⚪ NEW',
  'LẶP LẠI VÌ QUÊN': 'REQUEUED',
  'ĐÁP ÁN CỐT LÕI': 'CORE ANSWER',
  'NGỮ CẢNH GỐC': 'ORIGINAL CONTEXT',
  '▸ Xem toàn bộ mục gốc': '▸ Show Full Source',
  '▾ Ẩn toàn bộ mục gốc': '▾ Hide Full Source',
  'Đánh dấu đã làm chủ': 'Mark as Mastered',
  'Gợi ý': 'Hint',
  'Ẩn gợi ý': 'Hide Hint',
  'lật ·': 'flip ·',
  'lật thẻ ·': 'flip ·',
  'chấm nhớ ·': 'rate ·',
  'chọn đáp án ·': 'select ·',
  'chuyển': 'navigate',
  'CÂU HỎI': 'CARDS',
  '· THUỘC': '· SOLID',
  '· BÀI LÀM CHỦ': '· MASTERED',
  'TRỐNG / HOÀN TẤT ÔN TẬP': 'EMPTY / DRILL COMPLETE',
  'Bạn đã đánh dấu THUỘC CHẮC tất cả câu hỏi trong bộ lọc này!': 'You marked ALL cards in this filter as SOLID!',
  'Không còn thẻ nào ở bộ lọc hiện tại.': 'No remaining cards match the current filter.',
  'Quay lại toàn bộ bài': 'Return to All Items',
  '(Bạn chưa gõ nháp — tự đối chiếu nhẩm với đáp án bên phải)': '(No draft typed — compare silently with the reference answer on the right)',
  'CÂU HỎI KIỂM TRA TRÍ NHỚ': 'ACTIVE RECALL QUESTION',
  'CÂU HỎI TRẮC NGHIỆM (CHỌN A/B/C/D HOẶC PHÍM 1-4)': 'MULTIPLE CHOICE QUIZ (SELECT A/B/C/D OR KEYS 1-4)',
  'TỰ GÕ CÂU TRẢ LỜI ĐỂ ĐỐI CHIẾU KHI LẬT THẺ': 'TYPE YOUR ANSWER TO COMPARE',
  'CÂU TRẢ LỜI BẠN TỰ NHỚ': 'YOUR RECALLED ANSWER',
  'ĐÁP ÁN CHUẨN TRONG BÀI': 'REFERENCE ANSWER',
  'ĐÁP ÁN CHUẨN ĐANG ẨN — tự trả lời rồi bấm ': 'ANSWER HIDDEN — recall first, then press ',
  ' để đối chiếu': ' to check',
  'VỞ NHÁP GHI CHÚ NHANH': 'QUICK SCRATCHPAD',
  'VỞ NHÁP GHI CHÚ NHANH · PHÂN HỆ MRL': 'QUICK SCRATCHPAD · MRL MODULE',
  'VỞ NHÁP GHI CHÚ NHANH · LẬP TRÌNH PLC': 'QUICK SCRATCHPAD · PLC MODULE',
  'VỞ NHÁP GHI CHÚ NHANH · MẠNG TRUYỀN THÔNG': 'QUICK SCRATCHPAD · NETWORK MODULE',
  'VỞ NHÁP TIẾNG ANH · ĐỌC DỊCH MANUAL & TẠO QUIZ': 'ENGLISH SCRATCHPAD · MANUAL READER & QUIZ BUILDER',
  'Gõ tự do · Bôi đen từ để dịch & lưu · Dán ảnh (': 'Type freely · Highlight text to translate & save · Paste images (',
  ') kéo thả tự do': ') drag & resize',
  '📄 Nạp mẫu Manual': '📄 Load Sample Manual',
  '⚡ Tạo Quiz từ Nháp': '⚡ Quiz from Scratchpad',
  'Font: Chữ thường': 'Font: Sans-serif',
  'Font: Kỹ thuật (Mono)': 'Font: Monospace',
  'Font: Thường': 'Font: Sans',
  '+ Chèn ảnh': '+ Insert Image',
  'Lưu (Ctrl+S)': 'Save (Ctrl+S)',
  'Xóa trắng': 'Clear All',
  'ĐÃ LƯU TỰ ĐỘNG': 'AUTO-SAVED',
  'ĐANG GÕ...': 'TYPING...',
  'LỖI LƯU NHÁP': 'SAVE FAILED',
  'LỖI LƯU': 'SAVE ERROR',
  'NHÁP ENG': 'PAD ENG',
  'NHÁP PLC': 'PAD PLC',
  'NHÁP NET': 'PAD NET',
  'NHÁP MRL': 'PAD MRL',
  'Nháp Tiếng Anh': 'English Scratchpad',
  'Nháp PLC': 'PLC Scratchpad',
  'Nháp NET': 'Network Scratchpad',
  'Nháp MRL': 'MRL Scratchpad',
  'CHƯA CÓ TAB NÀO MỞ': 'NO OPEN TABS',
  'OPENQUIZ AI': 'OPENQUIZ AI',
  'Trắc nghiệm & Điền từ': 'MCQ & Cloze Quiz',
  'COACH 1-1': 'COACH 1-1',
  'VOCAB': 'VOCAB',
  'ÔN TẬP': 'DRILL',
  'TRA CỨU': 'LOOKUP',
  'SOP': 'SOP',
  'NHÁP': 'PAD',
  'LINH KIỆN HAY GẶP': 'FREQUENT COMPONENTS',
  'MÃ LỖI GHI NHẬN': 'LOGGED FAULT CODES',
  'Chế độ sáng': 'Light Mode',
  'Chế độ tối': 'Dark Mode',
  '⚙ Bộ lọc': '⚙ Filters',
  'Đặt lại bộ lọc': 'Reset Filters',
  'Trạng thái ôn': 'Review Status',
  'Loại thẻ': 'Card Scope',
  'Khôi phục mặc định': 'Reset Defaults',
  '↺ Khôi phục mặc định': '↺ Reset to Defaults',
  '+ Thêm mục': '+ Add Category',
  'TÙY CHỈNH THANH DANH MỤC': 'CUSTOMIZE CATEGORY BAR',
  'QUẢN LÝ DANH MỤC': 'CATEGORY MANAGER',
  'HỌC TIẾNG ANH CHUYÊN NGÀNH KỸ THUẬT': 'TECHNICAL ENGLISH WORKBENCH',
  'SỔ TỪ VỰNG & THUẬT NGỮ VI ⇄ EN': 'TECHNICAL ENGLISH VOCABULARY VI ⇄ EN',
  'Thêm câu hỏi': '+ Add Q&A',
  'KHỐI HÀM FB/FC/OB': 'FUNCTION BLOCKS (FB/FC/OB)',
  'VÙNG NHỚ DB/UDT': 'MEMORY AREAS (DB/UDT)',
  'ĐẤU NỐI & BẢN VẼ': 'WIRING & SCHEMATICS',
  'TẤT CẢ': 'ALL',
  'BO MẠCH': 'CIRCUIT BOARD',
  'HMI / MÀN HÌNH': 'HMI / SCREEN',
  'CẢM BIẾN': 'SENSORS',
  'KIẾN THỨC ĐO & SỬA': 'MEASUREMENT & REPAIR',
  'TỰ ĐỘNG HÓA': 'AUTOMATION',
  'MÃ LỖI NHANH': 'QUICK FAULT CODES',
  'MẠCH & BIẾN TẦN': 'CIRCUITS & VFD',
  'Mạch & Biến tần': 'Circuits & VFD',
  'PLC & MẠNG': 'PLC & NETWORK',
  'PLC & Mạng': 'PLC & Network',
  'Cụm từ nối Lexical Chunks': 'Lexical Chunks',
  'LEXICAL CHUNKS': 'LEXICAL CHUNKS',
  'Phiên âm IPA:': 'IPA Pronunciation:',
  'Phát âm chuẩn': 'Pronounce',
  'lật nhanh': 'quick flip',
  'TIẾNG ANH CHUYÊN NGÀNH': 'TECHNICAL ENGLISH',
  'TỪ VỰNG KỸ THUẬT VI ⇄ EN': 'TECHNICAL VOCAB VI ⇄ EN',
  'Đóng tab': 'Close tab',
  'Đóng thông báo': 'Close notification',
  'Chủ đề': 'Topic',
  'Nguồn': 'Source',
  'Trạng thái': 'Status',
  'Chuyển nhanh phân hệ': 'Switch workspace',
  'Điều hướng phân hệ': 'Workspace navigation',
  'Ngôn ngữ / Language': 'Language',
  'Thêm nhanh mục mới vào thanh này': 'Quick-add a new category to this bar',
  'Quản lý danh mục: Sửa tên, Đổi thứ tự, Thêm, Xóa': 'Manage categories: Rename, Reorder, Add, Delete',
  'Hiện/Ẩn thanh menu dọc bên trái (Ctrl+B)': 'Toggle left sidebar (Ctrl+B)',
  'Ẩn thanh menu dọc bên trái (Ctrl+B)': 'Hide left sidebar (Ctrl+B)',
  'Quay về màn hình chọn 4 phân hệ (Alt+Home)': 'Return to 4-module Portal (Alt+Home)',
  'Nhóm thiết bị (Ca sửa chữa)': 'Equipment Groups (Repair Cases)',
  'Nhóm nguồn (Kiến thức & SOP)': 'Source Groups (Knowledge & SOP)',
  'ĐÃ LÀM CHỦ': 'MASTERED',
  'CẦN XEM LẠI': 'NEEDS REVIEW',
  'ĐANG NGHIÊN CỨU': 'RESEARCHING',
  'CHƯA PHÂN LOẠI': 'UNCLASSIFIED',
  'KHUNG CHÍNH': 'PRIMARY PANE',
  'KHUNG 1': 'PANE 1',
  'KHUNG 2': 'PANE 2',
  'ĐANG XEM': 'VIEWING',
  '◫ Ghim sang Khung 2 →': '◫ Pin to Pane 2 →',
  '☰ Tìm bài': '☰ Browse',
  'CA SỬA': 'REPAIRS',
  '⭐ Sổ Từ Vựng': '⭐ Vocabulary',
  '🔊 Nghe EN': '🔊 Listen EN',
  'Tất cả loại thẻ': 'All Card Types',
  'Chỉ ca sửa chữa': 'Repair Cases Only',
  'Chỉ kiến thức & SOP': 'Knowledge & SOP Only',
  'Chỉ lập trình PLC': 'PLC Notes Only',
  'Chỉ mạng truyền thông': 'Network Notes Only',
  'Hỏi sâu từng ý': 'Deep Drill (Per Point)',
  'Trắc nghiệm 4 đáp án (Quiz)': '4-Option Quiz (A/B/C/D)',
  'Tổng hợp (1 thẻ / bài)': 'Summary (1 Card / Note)',
  '🇬🇧 Từ vựng Tiếng Anh chuyên ngành (Việt ⇄ Anh)': '🇬🇧 Technical English Vocab (VI ⇄ EN)',
  '🇬🇧 Trắc nghiệm Tiếng Anh (Quiz A/B/C/D)': '🇬🇧 Technical English Quiz (A/B/C/D)',
  'Cần xem lại + đang nghiên cứu': 'Needs Review + Researching',
  'Chỉ cần xem lại': 'Needs Review Only',
  'Chỉ đang nghiên cứu': 'Researching Only',
  'Tất cả (kể cả đã làm chủ)': 'All Items (Incl. Mastered)',
  'Trạng thái: tất cả': 'Status: All',
  'Trạng thái: đã làm chủ': 'Status: Mastered',
  'Trạng thái: cần xem lại': 'Status: Needs Review',
  'Trạng thái: đang nghiên cứu': 'Status: Researching',
  'Trạng thái: chưa phân loại': 'Status: Unclassified',
  // Tab 01: OpenQuiz AI
  '01 · OPENQUIZ AI': '01 · OPENQUIZ AI',
  'TRẮC NGHIỆM MCQ': 'MULTIPLE CHOICE MCQ',
  'ĐIỀN TỪ CLOZE': 'FILL-IN CLOZE',
  'GHÉP THUẬT NGỮ': 'TERM MATCHING',
  'Chủ đề: Tất cả': 'Topic: All',
  '⚡ Tạo đề tự động': '⚡ Auto-Generate Quiz',
  'Chế độ 1: Từ Kho Từ & 83 Ca MRL/PLC/NET': 'Mode 1: From Vocab & 83 MRL/PLC/NET Cases',
  'Chế độ 2: Dán Manual Tiếng Anh (Paste Text)': 'Mode 2: Paste English Manual Text',
  'Sinh câu hỏi mới kết hợp Kho Từ vựng + 83 bản ghi kỹ thuật trong máy:': 'Generate new questions from Vocab Bank + 83 technical records:',
  '5 câu': '5 questions',
  '6 câu': '6 questions',
  '8 câu': '8 questions',
  '10 câu': '10 questions',
  '12 câu': '12 questions',
  '⚡ Tạo đề mới ngay': '⚡ Generate Quiz Now',
  '⚡ Tạo Quiz ngay': '⚡ Generate Quiz Now',
  '⏳ Đang sinh bộ câu hỏi...': '⏳ Generating quiz set...',
  '📄 Nạp mẫu Manual Biến tần VFD': '📄 Load Sample VFD Manual',
  '📄 Nạp mẫu Manual PLC S7-1200': '📄 Load Sample S7-1200 Manual',
  'CÂU': 'QUESTION',
  'ĐÚNG:': 'CORRECT:',
  'SAI:': 'WRONG:',
  'ĐIỂM:': 'SCORE:',
  '🔀 Trộn & Làm lại đề': '🔀 Shuffle & Restart',
  'ĐIỀN TỪ / LEXICAL CHUNK VÀO CHỖ TRỐNG': 'FILL IN THE MISSING TERM / LEXICAL CHUNK',
  'GHÉP THUẬT NGỮ CHUYÊN NGÀNH': 'MATCH THE TECHNICAL TERM',
  'ĐỌC HIỂU MANUAL & TRẮC NGHIỆM KỸ THUẬT': 'MANUAL READING & TECHNICAL MCQ',
  'Kiểm tra': 'Check',
  'GIẢI THÍCH CHI TIẾT BẰNG TIẾNG VIỆT': 'DETAILED TECHNICAL EXPLANATION',
  'TRÍCH DẪN NGỮ CẢNH KỸ THUẬT GỐC': 'ORIGINAL TECHNICAL CONTEXT QUOTE',
  '🔊 Nghe câu gốc': '🔊 Listen to Quote',
  '⭐ Lưu từ': '⭐ Save Term',
  '← Câu trước': '← Prev Question',
  'Câu tiếp theo →': 'Next Question →',
  'Xem đáp án': 'Show Answer',
  'CHƯA CÓ CÂU HỎI PHÙ HỢP BỘ LỌC HIỆN TẠI': 'NO QUESTIONS MATCH THE CURRENT FILTER',
  'Thử đổi bộ lọc hoặc bấm "⚡ Tạo đề mới ngay" ở khung trên để sinh câu hỏi.': 'Try changing filters or click "⚡ Generate Quiz Now" above to create questions.',
  // Tab 02: Coach 1-1
  '02 · LUYỆN DỊCH & GRAMMAR COACH 1-1': '02 · TECH TRANSLATION & GRAMMAR COACH 1-1',
  'Nguồn: Tất cả (MRL + PLC + NET + Phỏng vấn)': 'Source: All (MRL + PLC + NET + Interview)',
  'Ca sửa chữa & Biến tần (MRL)': 'Repair Cases & VFDs (MRL)',
  'Lập trình PLC & TIA Portal': 'PLC Programming & TIA Portal',
  'Mạng Truyền thông Công nghiệp': 'Industrial Communication Networks',
  '🎲 Lấy câu ngẫu nhiên': '🎲 Random Prompt',
  '✍️ Tự nhập câu tiếng Việt': '✍️ Custom Prompt',
  'ĐỀ LUYỆN DỊCH & PHỎNG VẤN KỸ THUẬT': 'TECH TRANSLATION & INTERVIEW PROMPT',
  'CÂU TRẢ LỜI TIẾNG ANH CỦA BẠN': 'YOUR ENGLISH ANSWER',
  'để chấm điểm': 'to evaluate',
  '🔊 Nghe câu bạn viết': '🔊 Listen to Your Draft',
  '🎲 Đổi câu khác': '🎲 Next Prompt',
  '🎯 Chấm điểm & Sửa lỗi': '🎯 Evaluate & Fix Grammar',
  '⏳ Đang chấm điểm & phân tích...': '⏳ Analyzing & grading...',
  '[SỬA NGỮ PHÁP & CÁCH DIỄN ĐẠT]': '[GRAMMAR & PHRASING CORRECTION]',
  '[CÂU MẪU CHUẨN KỸ SƯ (NATURAL ENGINEERING EXPRESSION)]': '[NATURAL ENGINEERING EXPRESSION]',
  '[TỪ VỰNG CỐT LÕI CẦN NHỚ]': '[KEY VOCABULARY TO REMEMBER]',
  '🔊 Nghe': '🔊 Listen',
  '📋 Copy': '📋 Copy',
  '✓ Đã lưu': '✓ Saved',
  '✓ Đã lưu vào Kho': '✓ Saved to Bank',
  '+ Lưu vào Kho từ vựng': '+ Save to Vocab Bank',
  'Chưa bóc tách được thêm từ mới từ câu này — bạn có thể bấm \'+ Thêm Từ / Chunk\' ở sidebar bất kỳ lúc nào.': 'No extra terms extracted from this prompt — click "+ Add Vocab / Chunk" in the sidebar anytime.',
  // Tab 03: Vocab Bank
  '🧠 Ôn Flashcard': '🧠 Flashcard Drill',
  '🔊 Phát âm EN': '🔊 Listen EN',
  '🔊 Phát âm chuẩn (US/UK)': '🔊 Pronounce (US/UK)',
  'NGHĨA TIẾNG VIỆT & NGỮ CẢNH SỬ DỤNG': 'MEANING & ENGINEERING CONTEXT',
  'VÍ DỤ SONG NGỮ TRONG TÀI LIỆU HÃNG / CA SỬA CHỮA': 'BILINGUAL EXAMPLES FROM MANUALS / REPAIR CASES',
  '🔊 Nghe câu ví dụ': '🔊 Listen to Example',
  'THỰC HÀNH NHANH VỚI CỤM TỪ NÀY': 'QUICK PRACTICE WITH THIS ITEM',
  '🎯 Luyện dịch 1-1 với cụm này': '🎯 Practice 1-1 in Coach',
  '🧠 Vào Flashcard Tiếng Anh': '🧠 Open English Flashcards',
  // Modals (Vocab & AI Config)
  'THÊM TỪ VỰNG / CỤM TỪ MỚI': 'ADD NEW VOCABULARY / CHUNK',
  'THÊM TỪ VỰNG / LEXICAL CHUNK MỚI': 'ADD NEW VOCABULARY / LEXICAL CHUNK',
  'Thuật ngữ / Cụm Lexical Chunk Tiếng Anh *': 'English Term / Lexical Chunk *',
  'Phiên âm IPA (tùy chọn)': 'IPA Pronunciation (optional)',
  'Phân loại *': 'Category *',
  'Nguồn tham chiếu (tùy chọn)': 'Reference Source (optional)',
  'Trạng thái': 'Status',
  'Nghĩa Tiếng Việt & Cách dùng trong kỹ thuật *': 'Vietnamese Meaning & Engineering Context *',
  'Câu ví dụ Tiếng Anh thực tế (Context EN)': 'Real-World English Example (Context EN)',
  'Dịch câu ví dụ sang Tiếng Việt (Context VI)': 'Vietnamese Example Translation (Context VI)',
  'Lưu vào Kho từ vựng': 'Save to Vocab Bank',
  '🔑 CẤU HÌNH GEMINI API KEY (GOOGLE AI STUDIO)': '🔑 GEMINI API KEY SETTINGS (GOOGLE AI STUDIO)',
  'CHẾ ĐỘ LAI THÔNG MINH (HYBRID OFFLINE + GEMINI AI)': 'HYBRID ENGINE MODE (OFFLINE RULE-BASED + GEMINI AI)',
  'Gemini API Key (để trống nếu muốn xóa Key cũ hoặc dùng chế độ Offline)': 'Gemini API Key (leave blank to clear or use Offline mode)',
  'Model Gemini': 'Gemini Model',
  'Xóa Key (Dùng Offline)': 'Clear Key (Use Offline)',
  'Lưu cấu hình AI': 'Save AI Config',
  'gemini-2.0-flash (Nhanh & Miễn phí — Khuyên dùng)': 'gemini-2.0-flash (Fast & Free — Recommended)',
  'gemini-2.5-flash (Thông minh & Chuẩn xác cao)': 'gemini-2.5-flash (Smart & High Precision)',
  'Không cần API Key / Không có mạng:': 'No API Key / Offline:',
  'Phần mềm vẫn chạy đầy đủ bằng': 'Runs 100% locally using the',
  'Offline Rule-based Generator & Grammar Coach': 'Offline Rule-based Generator & Grammar Coach',
  'từ 83 bản ghi MRL/PLC/NET và Kho Từ vựng.': 'powered by 83 MRL/PLC/NET records and Vocab Bank.',
  'Khi dán Gemini API Key miễn phí:': 'With a free Gemini API Key:',
  'Lấy key tại': 'Get a free key at',
  '(lưu local trong SQLite trên máy bạn) để OpenQuiz AI sinh đề đọc hiểu Manual & chấm ngữ pháp 1-1 chuyên sâu bằng AI thật.': '(stored locally in SQLite) to unlock deep Manual Quiz Generation & AI Grammar Coaching.',
  'SỬA CHỮA / VFD': 'REPAIR / VFD',
  'KỸ THUẬT CHUNG': 'GENERAL TECH',
  '+ Thêm từ': '+ Add Term',
  'Tất cả nhóm': 'All Categories',
  '🧠 Ôn Flashcard Từ vựng': '🧠 Vocab Flashcards',
  '⚡ Quiz 4 đáp án': '⚡ 4-Option Quiz',
  'OPENQUIZ AI v2': 'OPENQUIZ AI v2',
  'TIẾN ĐỘ TIẾNG ANH SRS': 'TECHNICAL ENGLISH SRS PROGRESS',
  'Cần ôn hôm nay': 'Due Today',
  'Đang học': 'Learning',
  'Từ mới': 'New Cards',
  'Ôn tập SRS & Đa chế độ (Flashcard / Quiz / Nghe chép)': 'SRS Study & 4 Modes (Flashcard / Quiz / Dictation)',
  'Thực chiến Dịch câu & Phản xạ Nói (Sai đâu sửa đó)': '1-on-1 Combat Translation & Interview Drill',
  'Đọc hiểu Manual & Tình huống AI tự sinh': 'AI Manual Reading & Comprehension Quiz',
  'Kho Từ vựng & Cụm từ nối (Lexical Chunks)': 'Vocab Bank & Lexical Chunks',
  'Phễu Nạp Dữ Liệu Nhanh (AI Auto-Fill & Trích xuất MRL)': 'Rapid Data Ingestion (Magic Fill & MRL Scan)',
  '+ Thêm Từ / Chunk': '+ Add Card / Chunk',
  'Ôn tập SRS & Đa chế độ': 'SRS Study & 4 Modes',
  'Thực chiến 1-1 & Phản xạ': '1-on-1 Combat & Speaking',
  'Đọc hiểu Manual AI': 'AI Manual Reading',
  'Kho Từ & Lexical Chunks': 'Vocab & Lexical Chunks',
  'Phễu Nạp Dữ Liệu Nhanh': 'Rapid Ingestion Funnel',
  '+ THÊM TỪ / MAGIC FILL': '+ ADD CARD / MAGIC FILL',
  '📖 TẠO BÀI ĐỌC AI': '📖 GENERATE AI READING',
  '📝 VỞ NHÁP MANUAL': '📝 MANUAL SCRATCHPAD',
  'Tình huống thực chiến': 'Combat Drills',
  '01 · ÔN TẬP SRS & ĐA CHẾ ĐỘ': '01 · SRS STUDY & 4 MODES',
  '02 · PHÒNG THỰC CHIẾN 1-1': '02 · 1-ON-1 COMBAT LAB',
  '03 · ĐỌC HIỂU MANUAL & TÌNH HUỐNG AI': '03 · AI MANUAL READING LAB',
  '05 · PHỄU NẠP DỮ LIỆU NHANH & MANUAL READER': '05 · RAPID INGESTION & MANUAL READER',
  '📝 Mở Vở Nháp Manual': '📝 Open Manual Scratchpad',
  '🎲 Tình huống khác': '🎲 Another Scenario',
  '✍️ Tự nhập câu': '✍️ Custom Prompt',
  'Biến tần & Phần cứng': 'VFD & Power Hardware',
  'PLC & Tự động hóa': 'PLC & Automation',
  'Mạng truyền thông': 'Industrial Networks',
  'Lexical Chunks (Cụm từ nối)': 'Lexical Chunks (Connectors)',
  'Giao tiếp Phỏng vấn': 'Interview Communication',
  '📊 TRẠNG THÁI SRS HÔM NAY (SM-2)': '📊 TODAY SRS STATUS (SM-2)',
  'Tất cả thẻ': 'All Cards',
  '1. 🃏 Lật thẻ SRS (Flashcard)': '1. 🃏 SM-2 Flashcard',
  '2. ⚡ Trắc nghiệm tốc độ (Multiple Choice)': '2. ⚡ Speed Quiz (MCQ)',
  '3. 🧩 Điền cụm từ (Cloze / Chunking Test)': '3. 🧩 Cloze / Chunking Test',
  '4. 🎧 Nghe chép chính tả (Audio Dictation)': '4. 🎧 Audio Dictation',
  '← Thẻ trước': '← Prev Card',
  'Thẻ sau →': 'Next Card →',
  '🔊 Phát âm chuẩn': '🔊 Normal Audio',
  '🐢 Đọc chậm': '🐢 Slow (0.72x)',
  '👁️ Hiện nghĩa Tiếng Việt, Collocations & Ví dụ': '👁️ Reveal Meaning, Collocations & Example',
  '1 - Quên (Again)': '1 - Again',
  '2 - Khó (Hard)': '2 - Hard',
  '3 - Tốt (Good)': '3 - Good',
  '4 - Rất dễ (Easy)': '4 - Easy',
  'Chế độ A: Dịch Kỹ thuật': 'Mode A: Tech Translation',
  'Chế độ B: Phỏng vấn & Ép dùng từ': 'Mode B: Interview & Forced Output',
  'TỪ KHÓA BẮT BUỘC:': 'MANDATORY KEYWORDS:',
  'CHẾ ĐỘ B: PHỎNG VẤN KỸ SƯ SENIOR (FORCED OUTPUT)': 'MODE B: SENIOR ENGINEER INTERVIEW (FORCED OUTPUT)',
  'CHẾ ĐỘ A: LUYỆN DỊCH BÁO CÁO KỸ THUẬT': 'MODE A: TECHNICAL REPORT TRANSLATION',
  'CÂU TRẢ LỜI / DỊCH TIẾNG ANH CỦA BẠN (Ctrl+Enter để nộp):': 'YOUR ENGLISH ANSWER / TRANSLATION (Ctrl+Enter to submit):',
  '🎙️ Nói Tiếng Anh (Mic)': '🎙️ Speak English (Mic)',
  '🚀 Chấm điểm & Sửa 3 khung AI': '🚀 Grade & Review (3 Frames)',
  '💡 Gợi ý cụm nối': '💡 Connector Hint',
  '1. [SỬA NGỮ PHÁP & CÁCH DIỄN ĐẠT]': '1. [GRAMMAR & PHRASING CORRECTION]',
  '2. [CÂU MẪU CHUẨN KỸ SƯ]': '2. [NATURAL ENGINEER EXPRESSIONS]',
  '📄 VĂN VIẾT BÁO CÁO KỸ THUẬT (Technical Report):': '📄 WRITTEN TECHNICAL REPORT:',
  '🎤 VĂN NÓI PHỎNG VẤN / GIAO TIẾP (Spoken Interview):': '🎤 SPOKEN INTERVIEW / EXPLANATION:',
  '3. [ĐIỂM SỐ & THUẬT NGỮ CẦN GHI NHỚ]': '3. [SCORE & KEY TERMS TO SAVE]',
  '+ Lưu vào SRS': '+ Save to SRS',
  '🇻🇳 Hiện dịch song ngữ': '🇻🇳 Toggle Bilingual VI',
  '🔊 Nghe đọc toàn bài': '🔊 Read Full Passage',
  '✅ KIỂM TRA ĐỌC HIỂU (3 CÂU HỎI NGỮ CẢNH)': '✅ READING COMPREHENSION (3 MCQs)',
  '🔄 Tạo bài khác': '🔄 Regenerate Reading',
  'SRS: Tất cả': 'SRS: All Stages',
  'Đang học (Learning)': 'Learning',
  'Từ mới (New)': 'New',
  'Ôn tập (Review)': 'Review',
  'Đã làm chủ (Mastered)': 'Mastered',
  '🧠 Ôn Flashcard SRS': '🧠 SRS Flashcards',
  '🎤 Thực chiến 1-1': '🎤 1-on-1 Practice',
  '↺ Reset SRS': '↺ Reset SRS',
  'NGHĨA CHUYÊN NGÀNH & COLLOCATIONS': 'TECHNICAL MEANING & COLLOCATIONS',
  'NGỮ CẢNH THỰC TẾ (SONG NGỮ EN ⇄ VI)': 'REAL CONTEXT (BILINGUAL EN ⇄ VI)',
  'THÔNG SỐ THUẬT TOÁN LẶP LẠI NGẮT QUÃNG (SM-2 SRS)': 'SPACED REPETITION PARAMETERS (SM-2 SRS)',
  '1. ✨ 1-Click Magic Fill': '1. ✨ 1-Click Magic Fill',
  '2. 🔄 Quét 83 ca MRL / PLC / NET': '2. 🔄 Scan 83 MRL / PLC / NET Records',
  '3. 📄 Dán Manual & Bóc tách': '3. 📄 Paste Manual & Extract',
  '✨ Tự động điền': '✨ Auto-Fill Card',
  '💾 Lưu vào Kho SRS': '💾 Save to SRS Bank',
  '🔄 Quét kho MRL ngay': '🔄 Scan MRL Vault Now',
  '📥 Nạp các mục đã chọn vào SRS': '📥 Import Selected to SRS',
  '⚡ Bóc tách thuật ngữ & Chunks': '⚡ Extract Terms & Chunks',
  '📥 Lưu mục đã tick vào Kho SRS': '📥 Save Selected to SRS',
  '✨ Magic Fill': '✨ Magic Fill',
  'Loại từ (Word Class)': 'Word Class',
  'Mức SRS': 'SRS Stage',
  'Cụm từ hay đi kèm (Collocations)': 'Common Collocations',
  'Liên kết ca bệnh (MRL/PLC/NET)': 'Linked Record (MRL/PLC/NET)',
  '✓ Kiểm tra & Chấm từng từ': '✓ Check & Diff Words',
  '👁️ Hiện đáp án gốc': '👁️ Reveal Original',
  'Học từ nào nói từ đó - Sai đến đâu sửa đến đó: Thuật toán lặp lại ngắt quãng SM-2, Thực chiến dịch câu & phản xạ phỏng vấn, Đọc hiểu Manual AI tự sinh và Phễu nạp từ 1-Click.': 'SM-2 Spaced Repetition, 1-on-1 Combat Translation & Speaking Drill, Contextual AI Manual Reading, and 1-Click Magic Fill Ingestion.',
  '+Nạp': '+Add',
  'Đang học / Từ mới': 'Learning / New',
  'BIẾN TẦN & PHẦN CỨNG': 'VFD & POWER HARDWARE',
  'PLC & TỰ ĐỘNG HÓA': 'PLC & AUTOMATION',
  'MẠNG TRUYỀN THÔNG': 'INDUSTRIAL NETWORKS',
  'PHỎNG VẤN KỸ SƯ': 'INTERVIEW ENGLISH',
  'GIAO TIẾP PHỎNG VẤN': 'INTERVIEW COMMUNICATION',
  'KHO TỪ VỰNG & LEXICAL CHUNKS': 'VOCAB BANK & LEXICAL CHUNKS',
  '☰ Hiện menu': '☰ Menu',
  'Câu tiếp →': 'Next →',
  '← Câu trước': '← Prev',
  '🔊 Nghe chuẩn (1.0x)': '🔊 Normal (1.0x)',
  '🐢 Nghe chậm (0.75x)': '🐢 Slow (0.75x)',
  '🔁 Lưu SM-2: Quên (10m)': '🔁 SM-2: Again (10m)',
  '✓ Lưu SM-2: Tốt (+1 ngày / chuỗi)': '✓ SM-2: Good (+1d / streak)',
  'Chọn mức độ nhớ bên dưới để lên lịch:': 'Choose recall grade below:',
  '🔊 Đọc câu ví dụ': '🔊 Play Example',
  'Cụm từ hay đi kèm:': 'Collocations:',
  'Bấm vào bất kỳ từ tô vàng nào trong bài để xem IPA, nghĩa Việt và đánh dấu đã ôn SRS!': 'Click any highlighted term to inspect IPA, meaning, and grade SRS!',
  '✓ Đánh dấu Đã ôn (+1)': '✓ Mark Reviewed (+1)',
  '🔊 Nghe từ': '🔊 Speak Word',
  '🔊 Nghe phát âm': '🔊 Pronounce',
  '← Trước': '← Prev',
  'Sau →': 'Next →',
  '✎ Sửa': '✎ Edit',
  '✕ Xóa': '✕ Delete',
  'Trạng thái:': 'Stage:',
  'Khoảng cách ôn:': 'Interval:',
  'Số lần đúng:': 'Repetitions:',
  'Đến hạn tới:': 'Next review:',
  'Ngay hôm nay': 'Due today',
  'Mới (New)': 'New',
  'Đang học (Learning)': 'Learning',
  'Ôn lại (Review)': 'Review',
  'Đã làm chủ (Mastered)': 'Mastered',
  'Báo cáo Kỹ thuật Thực chiến': 'Field Service Report',
  'Học hôm nay (SRS & 4 Chế độ)': 'Study Today (SRS & 4 Modes)',
  'Phòng Thực Chiến (Nói, Dịch & Đọc)': 'Combat Lab (Speak, Translate & Read)',
  'Kho Từ & Nạp Từ AI (Magic Fill)': 'Vocab Bank & AI Fill',
  '01 · HỌC HÔM NAY': '01 · STUDY TODAY',
  '02 · PHÒNG THỰC CHIẾN': '02 · COMBAT LAB',
  'Giao tiếp & Hội thoại': 'Daily & Workplace Speaking',
  'GIAO TIẾP & HỘI THOẠI': 'DAILY & WORKPLACE SPEAKING',
  'Chủ đề: Tất cả (Giao tiếp + Kỹ thuật)': 'Topic: All (Speaking + Technical)',
  'Tất cả': 'All',
  'Chế độ A: Giao tiếp & Hội thoại': 'A: Daily & Workplace Speaking',
  'Chế độ B: Dịch Kỹ Thuật & Bản vẽ': 'B: Tech Translation & Schematics',
  'Chế độ C: Phỏng vấn 1-1 & Mic': 'C: 1-1 Interview & Mic',
  'Chế độ D: Đọc hiểu & Manual AI': 'D: Contextual Manual Reading',
  'CHẾ ĐỘ A: GIAO TIẾP & PHẢN XẠ HỘI THOẠI (DAILY & WORKPLACE)': 'MODE A: DAILY & WORKPLACE SPEAKING REFLEX',
  'CHẾ ĐỘ B: LUYỆN DỊCH KỸ THUẬT & GIẢI THÍCH BẢN VẼ': 'MODE B: TECHNICAL TRANSLATION & SCHEMATICS',
  'CHẾ ĐỘ C: PHỎNG VẤN KỸ SƯ 1-1 & ÉP DÙNG TỪ (MIC)': 'MODE C: SENIOR ENGINEER INTERVIEW (FORCED OUTPUT)',
  '📖 Tạo bài đọc từ 5-10 từ Cần ôn hôm nay': '📖 Generate Reading (5-10 Due Terms)',
  '5 từ mục tiêu': '5 target terms',
  '7 từ Cần ôn hôm nay': '7 Due Today terms',
  '10 từ tổng hợp': '10 combined terms',
  '⚡ NẠP TỪ NHANH:': '⚡ RAPID INGEST:',
  '✕ Thu gọn': '✕ Collapse',
  '✨ 1-Click Magic Fill (Gõ 1 từ tự điền trọn bộ)': '✨ 1-Click Magic Fill (Auto-Fill Card)',
  '🔄 Quét từ 83 ca MRL/PLC/NET': '🔄 Scan 83 MRL/PLC/NET Records',
  '📄 Dán Manual & Bóc tách từ': '📄 Paste Manual & Extract Terms',
  '🧠 Ôn thẻ này ở Phòng 01': '🧠 Review in Room 01',
  '✨ 1-CLICK MAGIC FILL (NHẬP 1 TỪ → TỰ ĐIỀN TOÀN BỘ THẺ SRS)': '✨ 1-CLICK MAGIC FILL (1 TERM → FULL SRS CARD)',
  '🔄 QUÉT 83 BẢN GHI MRL / PLC / NETWORK ĐỂ TRÍCH XUẤT TỪ & TÌNH HUỐNG MỚI': '🔄 SCAN 83 MRL / PLC / NETWORK RECORDS FOR NEW TERMS & DRILLS',
  '📄 DÁN ĐOẠN VĂN MANUAL TIẾNG ANH → BÓC TÁCH THUẬT NGỮ HÀNG LOẠT': '📄 PASTE ENGLISH MANUAL → BULK EXTRACT TERMS & CHUNKS',
  '📋 Nạp mẫu Manual VFD': '📋 Load Sample VFD Manual',
  '📋 Nạp mẫu Siemens PROFINET': '📋 Load Sample Siemens PROFINET',
  '✓ CHÍNH XÁC! Đã cập nhật SM-2 & tiến độ chuỗi ngày học.': '✓ CORRECT! SM-2 schedule & streak updated.',
  '📱 Mobile & Cloud Sync': '📱 Mobile & Cloud Sync',
  'Trang chủ': 'Home',
  'Sửa mạch': 'Repair',
  'PLC & Mạng': 'PLC & Net',
  'Tiếng Anh': 'English',
  'Đồng bộ': 'Sync',
  '← Quay lại danh sách': '← Back to list',
  '📷 Chụp ảnh Bo mạch / Máy đo': '📷 Capture PCBA / Meter Photo',
};

const PLACEHOLDER_I18N_MAP = {
  'Tìm ca lỗi, IGBT, OC...': 'Search faults, IGBT, OC...',
  'Tìm mã máy, linh kiện (A3120), mã lỗi...': 'Search model, component (A3120), fault...',
  'Tìm nguyên lý, đo kiểm, mã lỗi...': 'Search principles, SOP, faults...',
  'Tìm chủ đề, từ khóa, quy trình...': 'Search topic, keyword, SOP...',
  'Tìm khối hàm (FB/FC/OB), SCL...': 'Search FB/FC/OB, SCL...',
  'Tìm giao thức, 0x0001, Yaskawa...': 'Search protocol, 0x0001, Yaskawa...',
  'Tìm giao thức, thiết bị, thanh ghi...': 'Search protocol, device, register...',
  'Tìm mã linh kiện hoặc mã lỗi (VD: A3120, IGBT, oL1, UC3844...)...': 'Search component or fault code (e.g. A3120, IGBT, oL1)...',
  'Lọc nhanh mã linh kiện (A3120, IGBT) hoặc mã lỗi (oPE04)...': 'Filter components (A3120, IGBT) or faults (oPE04)...',
  'Tìm nhanh từ vựng Việt / Anh...': 'Filter vocabulary (VI / EN)...',
  'Thuật ngữ / Câu Tiếng Việt (VD: vòng quét chương trình)': 'Vietnamese term / phrase (e.g. vòng quét chương trình)',
  'Thuật ngữ Tiếng Anh (VD: Program scan cycle)': 'English term (e.g. Program scan cycle)',
  'Câu ví dụ Tiếng Việt (tùy chọn)...': 'Vietnamese example (optional)...',
  'Câu ví dụ Tiếng Anh (tùy chọn)...': 'English example (optional)...',
  'Tìm xuyên phân hệ: PLC-003, NET-001, Yaskawa, Modbus, Nháp...': 'Cross-module search: PLC-003, NET-001, Yaskawa, Modbus...',
  'Tìm thuật ngữ, phiên âm, Lexical Chunk, nghĩa Việt...': 'Search term, IPA, Lexical Chunk, or meaning...',
  'Tìm thuật ngữ, IPA, Collocations, nghĩa Việt...': 'Search term, IPA, Collocations, or meaning...',
  'Tự gõ từ điền khuyết (nhấn Enter) HOẶC chọn A/B/C/D bên dưới...': 'Type missing term (press Enter) OR choose A/B/C/D below...',
  'Tự gõ đáp án (nhấn Enter) HOẶC chọn A/B/C/D...': 'Type answer (press Enter) OR choose A/B/C/D...',
  'Gõ lại câu Tiếng Anh bạn vừa nghe được...': 'Type the English sentence you just heard...',
  'Viết hoặc bấm Micro 🎙️ nói câu Tiếng Anh (cố gắng lồng ghép các từ khóa mục tiêu phía trên)...': 'Type or click Mic 🎙️ to speak your English answer (incorporate the target keywords above)...',
  'Nhập tình huống Tiếng Việt bạn muốn luyện diễn đạt sang Tiếng Anh...': 'Enter a Vietnamese engineering scenario to practice translating into English...',
  'VD: bootstrap capacitor, optocoupler, galvanic isolation, flyback diode...': 'e.g. bootstrap capacitor, optocoupler, galvanic isolation, flyback diode...',
  'VD: Inrush current hoặc Regarding the wiring diagram...': 'e.g. Inrush current or Regarding the wiring diagram...',
  'VD: limit inrush current, high inrush current': 'e.g. limit inrush current, high inrush current',
  'VD: REP-001, PLC-004, NET-001': 'e.g. REP-001, PLC-004, NET-001',
  'Dán đoạn tài liệu kỹ thuật Manual Yaskawa, Siemens, Allen-Bradley, Modbus/PROFINET vào đây...': 'Paste Yaskawa, Siemens, Allen-Bradley, or Modbus/PROFINET English manual text here...',
  "Dán bất kỳ đoạn tài liệu Manual biến tần / PLC / Servo / Mạng bằng Tiếng Anh vào đây (VD: cảnh báo lỗi, mô tả khối OB/FB, đấu nối RS485...) rồi bấm 'Tạo Quiz ngay'...": "Paste any English VFD / PLC / Servo / Network manual excerpt here (e.g. fault troubleshooting, OB/FB notes, RS485 wiring...) and click 'Generate Quiz Now'...",
  'Gõ câu Tiếng Anh của bạn (VD: In order to isolate the root cause, disconnect the motor leads before measuring...)...': 'Write your English sentence (e.g. In order to isolate the root cause, disconnect the motor leads before measuring...)...',
  'Nhập câu mô tả lỗi hoặc câu Tiếng Việt bạn muốn tập viết sang Tiếng Anh...': 'Enter any Vietnamese technical sentence you want to translate into English...',
  'Gõ nhanh những gì bạn nhớ được (hoặc tự nhẩm rồi bấm Lật thẻ)...': 'Type what you recall (or think through it and press Flip Card)...',
  "Viết nhanh ý tưởng, tóm tắt video/datasheet, tính toán thanh ghi, hoặc dán đoạn Manual tiếng Anh để bôi đen dịch & lưu từ mới...\n\nMẹo: Bấm Win+Shift+S chụp trang tài liệu/datasheet rồi click vào đây nhấn Ctrl+V để dán ảnh trực tiếp, sau đó kéo đặt ảnh ở bất kỳ vị trí nào bạn muốn!": "Jot down quick notes, datasheet summaries, register calculations, or paste English manual excerpts to highlight & save new terms...\n\nTip: Press Win+Shift+S to capture a manual snippet, click here and press Ctrl+V to paste & drag anywhere!",
  'VD: Pre-charge resistor hoặc Regarding the fault symptom...': 'e.g. Pre-charge resistor or Regarding the fault symptom...',
  'VD: /priː tʃɑːdʒ rɪˈzɪstər/': 'e.g. /priː tʃɑːdʒ rɪˈzɪstər/',
  'VD: PLC-004, Yaskawa Manual...': 'e.g. PLC-004, Yaskawa Manual...',
  'VD: Điện trở mồi nạp tụ DC Bus': 'e.g. Pre-charge limiting resistor for DC bus capacitors',
  'VD: Check the pre-charge resistor if the VFD trips on DC bus undervoltage.': 'e.g. Check the pre-charge resistor if the VFD trips on DC bus undervoltage.',
  'VD: Kiểm tra điện trở mồi nếu biến tần báo lỗi thấp áp DC Bus.': 'e.g. Kiểm tra điện trở mồi nếu biến tần báo lỗi thấp áp DC Bus.',
  'Nhập tên mục mới (VD: HMI & SCADA, Motion Control...)...': 'New category name (e.g. HMI & SCADA, Motion Control...)...',
};

let _SORTED_I18N_ENTRIES = null;

function _translateUiString(raw) {
  const s = String(raw || '');
  const trimmed = s.trim();
  if (!trimmed) return s;
  if (UI_I18N_MAP[trimmed]) {
    return s.replace(trimmed, UI_I18N_MAP[trimmed]);
  }
  if (!_SORTED_I18N_ENTRIES) {
    _SORTED_I18N_ENTRIES = Object.entries(UI_I18N_MAP)
      .filter(([k]) => k.length >= 4)
      .sort((a, b) => b[0].length - a[0].length);
  }
  const rules = [
    [/^(\d+)\s+(?:BẢN GHI|MỤC)\s+·\s+4 PHÂN HỆ ĐỘC LẬP$/i, '$1 ITEMS · 4 INDEPENDENT WORKSPACES'],
    [/^(\d+)\s+BẢN GHI\s+·\s+3 PHÂN HỆ ĐỘC LẬP$/i, '$1 RECORDS · 3 INDEPENDENT WORKSPACES'],
    [/^(\d+)\s+mục học$/i, '$1 study items'],
    [/^(\d+)\s+bản ghi$/i, '$1 records'],
    [/^(\d+)\s+bài học$/i, '$1 lessons'],
    [/^(\d+)\s+cấu hình$/i, '$1 configs'],
    [/^(\d+)\s+ảnh$/i, '$1 imgs'],
    [/^(\d+)\s+bước$/i, '$1 steps'],
    [/^(\d+)\s+bài$/i, '$1 items'],
    [/^(\d+)\s+thanh ghi$/i, '$1 regs'],
    [/^Ca sửa:\s*(.+)$/i, 'Repair: $1'],
    [/^Kiến thức:\s*(.+)$/i, 'Knowledge: $1'],
    [/^Nhóm\s+(.+)$/i, 'Group: $1'],
    [/^⚡ TẠO ĐỀ TỰ ĐỘNG CHUẨN OPENQUIZ AI \((.+)\)$/i, '⚡ AUTO-GENERATE QUIZ · OPENQUIZ AI ($1)'],
    [/^Xem toàn bộ kho \((\d+) câu\)$/i, 'View Full Bank ($1 questions)'],
    [/^Nguồn:\s*(.+)$/i, 'Source: $1'],
    [/^Phiên âm IPA:\s*(.+)$/i, 'IPA Pronunciation: $1'],
    [/^✓ CHÍNH XÁC!\s*\((.+)\)$/i, '✓ CORRECT! ($1)'],
    [/^✕ CHƯA CHÍNH XÁC — Đáp án đúng là\s+(.+)$/i, '✕ INCORRECT — Correct Answer: $1'],
    [/^ĐIỂM:\s*(\d+\/\d+)\s*·\s*(.+)$/i, 'SCORE: $1 · $2'],
    [/^\[TỪ VỰNG CỐT LÕI CẦN NHỚ\]\s*\((\d+)\)$/i, '[KEY VOCABULARY TO REMEMBER] ($1)'],
    [/^CHỈNH SỬA TỪ VỰNG \/ CHUNK · #(\d+)$/i, 'EDIT VOCABULARY / CHUNK · #$1'],
    [/^SỔ TỪ VỰNG & THUẬT NGỮ VI ⇄ EN\s*\($/i, 'TECHNICAL ENGLISH VOCABULARY VI ⇄ EN ('],
    [/^🔑 Gemini Key \((.+)\)$/i, '🔑 Gemini Key ($1)'],
    [/^Bài này:\s*(\d+\/\d+)\s*thuộc$/i, 'This item: $1 solid'],
    [/^TIẾN ĐỘ\s+([^:]+):\s*(\d+\/\d+)\s*THUỘC$/i, 'PROGRESS $1: $2 SOLID'],
    [/^NHÁP ENG\s+·\s+(.+)$/i, 'PAD ENG · $1'],
    [/^NHÁP PLC\s+·\s+(.+)$/i, 'PAD PLC · $1'],
    [/^NHÁP NET\s+·\s+(.+)$/i, 'PAD NET · $1'],
    [/^NHÁP MRL\s+·\s+(.+)$/i, 'PAD MRL · $1'],
    [/^NHÁP (ENG|PLC|NET|MRL)\s*[—–-]\s*(.+)$/i, 'PAD $1 — $2'],
    [/^OPENQUIZ AI\s+·\s+(.+)$/i, 'OPENQUIZ AI · $1'],
    [/^COACH 1-1\s+·\s+(.+)$/i, 'COACH 1-1 · $1'],
    [/^VOCAB\s+·\s+(.+)$/i, 'VOCAB · $1'],
    [/^TRA CỨU\s+·\s+(.+)$/i, 'LOOKUP · $1'],
    [/^ÔN TẬP\s+·\s+(.+)$/i, 'DRILL · $1'],
    [/^QUY TRÌNH BẮT BỆNH & XỬ LÝ \((\d+) BƯỚC\)$/i, 'DIAGNOSTIC & REPAIR PROCEDURE ($1 STEPS)'],
    [/^HÌNH ẢNH DẠNG SÓNG & BO MẠCH \((\d+)\)$/i, 'WAVEFORMS & PCBA IMAGES ($1)'],
    [/^THÔNG SỐ CHÂN KHỐI HÀM \(PINOUT & PARAMETERS\)$/i, 'FUNCTION BLOCK PINOUT & PARAMETERS'],
    [/^BẢN ĐỒ THANH GHI & KHUNG TRUYỀN \(REGISTER MAP \/ TELEGRAM\)$/i, 'REGISTER MAP & TELEGRAM FRAME'],
    [/^VỞ NHÁP · (.+)$/i, 'SCRATCHPAD · $1'],
    [/^THẺ (\d+) \/ (\d+)$/, 'CARD $1 / $2'],
    [/^BƯỚC (\d+)$/, 'STEP $1'],
    [/^WORKBENCH\s+·\s+(\d+)\s+MỤC$/i, 'WORKBENCH · $1 ITEMS'],
    [/^(\d+)\s+thẻ SRS$/i, '$1 SRS cards'],
    [/^(\d+)\s+ngày liên tiếp$/i, '$1-day streak'],
    [/^Hôm nay:\s*(\d+\/\d+)\s*thẻ$/i, 'Today: $1 cards'],
    [/^(\d+)\s+ngày$/i, '$1 days'],
    [/^(\d+)\s+thẻ tổng$/i, '$1 total cards'],
    [/^ĐIỂM:\s*(\d+\/\d+)$/i, 'SCORE: $1'],
    [/^ĐOẠN\s+(\d+)$/i, 'PARAGRAPH $1'],
    [/^🔊 Nghe đoạn\s+(\d+)$/i, '🔊 Listen P$1'],
    [/^Câu\s+(\d+):\s*(.+)$/i, 'Question $1: $2'],
    [/^📖 Tạo bài đọc từ 5-10 từ Cần ôn hôm nay$/i, '📖 Generate Reading from 5-10 Due Terms'],
    [/^📖 Tạo bài đọc ngay từ\s+(\d+)\s+từ SRS hôm nay$/i, '📖 Generate Reading from $1 SRS Terms Today'],
    [/^CHỈNH SỬA THẺ\s+(.+)$/i, 'EDIT SRS CARD $1'],
    [/^(\d+)\s+từ mục tiêu$/i, '$1 target terms'],
    [/^(\d+)\s+từ Cần ôn hôm nay$/i, '$1 Due terms'],
    [/^(\d+)\s+từ tổng hợp$/i, '$1 mixed terms'],
    [/^Liên kết:\s*(.+)$/i, 'Linked: $1'],
    [/^Độ chính xác từng từ:\s*(\d+)%$/i, 'Word-by-word accuracy: $1%'],
    [/^⚡ TẠO ĐỀ TRẮC NGHIỆM BỔ SUNG TỪ MANUAL \((.+)\)$/i, '⚡ SUPPLEMENTAL MANUAL QUIZ ($1)'],
    [/^Đã quét\s+(\d+)\s+bản ghi\s*·\s*(\d+)\s*từ mới\s*·\s*(\d+)\s*câu thực chiến$/i, 'Scanned $1 records · $2 new cards · $3 combat drills'],
    [/^THẺ\s+(\d+)\s+\/\s+(\d+)$/, 'CARD $1 / $2'],
    [/^🔊 Nghe cả đoạn\s+(\d+)$/i, '🔊 Listen Paragraph $1'],
    [/^🎯 TỪ VỰNG MỤC TIÊU TRONG BÀI \((\d+)\s+—\s+bấm để nghe & xem nghĩa\):$/i, '🎯 TARGET WORDS ($1 — click to listen & inspect):'],
    [/^TỪ MỤC TIÊU SẼ ĐƯA VÀO BÀI ĐỌC \((\d+)\):$/i, 'TARGET WORDS TO WEAVE INTO READING ($1):'],
    [/^Đã tự động cập nhật SM-2 cho (\d+) thẻ:$/i, 'Auto-synced SM-2 for $1 card(s):'],
    [/^NGHE CHÉP CÂU\s+(\d+)\s+\/\s+(\d+)$/, 'DICTATION $1 / $2'],
    [/^ĐÃ LẤY:\s*(.+)$/, 'LOADED: $1'],
  ];
  for (const [pat, rep] of rules) {
    if (pat.test(trimmed)) {
      let out = trimmed.replace(pat, rep);
      for (const [viK, enV] of _SORTED_I18N_ENTRIES) {
        if (out.includes(viK)) out = out.replace(viK, enV);
      }
      return s.replace(trimmed, out);
    }
  }
  return s;
}

const CTX_I18N_MAP = {
  'HỌC TIẾNG ANH CHUYÊN NGÀNH': 'TECHNICAL ENGLISH',
  'Dịch đoạn đang chọn sang Tiếng Anh': 'Translate Selected Text',
  'Đọc phát âm Tiếng Anh': 'Pronounce in English',
  'Sao chép đoạn đang chọn': 'Copy Selection',
  'Hiển thị tất cả bài': 'Show All Records',
  'Danh sách bài trong mục': 'Records in Category',
  'Thêm bài mới': 'Add New Record',
  'Thêm bài mới vào mục này': 'Add Record to Category',
  'Ôn tập toàn phân hệ': 'Drill Whole Workspace',
  'Ôn tập riêng mục này': 'Drill This Category',
  'Đổi tên mục này': 'Rename Category',
  'Đưa sang trái': 'Move Left',
  'Đưa sang phải': 'Move Right',
  'Thêm danh mục mới': 'Add Category',
  'Quản lý toàn bộ danh mục...': 'Manage Categories...',
  'Xóa mục này': 'Delete Category',
  'Mở ở Khung chính': 'Open in Primary Pane',
  'Mở ở Khung 2 (Chia đôi)': 'Open in Pane 2 (Split)',
  'Ôn bài này': 'Drill This Note',
  'Đổi trạng thái nhanh': 'Quick Status Change',
  'Chuyển sang danh mục khác': 'Move to Category',
  'Sửa bài': 'Edit Note',
  'Sao chép mã & tiêu đề': 'Copy ID & Title',
  'Xóa bài': 'Delete Note',
  'Đưa tab này sang Khung 2': 'Send Tab to Pane 2',
  'Đóng tab này': 'Close Tab',
  'Đóng các tab khác': 'Close Other Tabs',
  'Đóng các tab bên phải': 'Close Tabs to the Right',
  'Đóng bớt (giữ tab đang xem)': 'Keep Active Tab Only',
  'Chưa có bài nào trong mục này': 'No records in this category',
};

function localizeMenuText(text) {
  if (!text) return text;
  if (CTX_I18N_MAP[text]) return CTX_I18N_MAP[text];
  const mFilter = String(text).match(/^Lọc theo "(.+)"$/);
  if (mFilter) {
    const inner = UI_I18N_MAP[mFilter[1]] || CATEGORY_LABELS_EN[mFilter[1]] || _lookupDynamicCategoryEn(mFilter[1]) || mFilter[1];
    return `Filter by "${inner}"`;
  }
  if (String(text).startsWith('DANH MỤC · ')) {
    const rest = text.slice(11);
    return `CATEGORY · ${UI_I18N_MAP[rest] || CATEGORY_LABELS_EN[rest] || _lookupDynamicCategoryEn(rest) || rest}`;
  }
  const mRem = String(text).match(/^Còn (\d+) bài khác.*$/);
  if (mRem) return `${mRem[1]} more records (click Filter to view all)`;
  return _translateUiString(text);
}

function localizeMenuEntries(entries) {
  return (entries || []).map((en) => {
    if (en.sep) return en;
    const next = { ...en };
    if (next.label) next.label = localizeMenuText(next.label);
    if (next.right) next.right = String(next.right).replace(/^(\d+) bài$/, '$1 items');
    if (Array.isArray(next.children)) next.children = localizeMenuEntries(next.children);
    return next;
  });
}

// ---- Compile Highlight Regexes (VI -> EN & EN -> VI) ----
function _enGetTermsDictionary() {
  const map = new Map();
  (state.enVocabulary || []).forEach((v) => {
    const vi = String(v.vi_term || '').trim();
    const en = String(v.en_term || '').trim();
    if (!vi || !en) return;
    map.set(vi.toLowerCase(), { vi, en, category: v.category || 'VOCAB', note: v.example_en || '', saved: true });
  });
  (state.enGlossary || []).forEach((g) => {
    const vi = String(g.vi || '').trim();
    const en = String(g.en || '').trim();
    if (!vi || !en) return;
    const k = vi.toLowerCase();
    if (!map.has(k)) {
      map.set(k, { vi, en, category: g.category || 'TECH', note: g.note || '', saved: false });
    }
  });
  return map;
}

function _enTermVariants(enRaw) {
  const raw = String(enRaw || '').trim();
  const out = [];
  if (raw) out.push(raw);
  const noParen = raw.replace(/\s*[\(\[].*?[\)\]]/g, '').trim();
  if (noParen.length >= 4 && !out.includes(noParen)) out.push(noParen);
  const noDash = noParen.split(/\s*[—–]\s*/)[0].trim();
  if (noDash.length >= 4 && !out.includes(noDash)) out.push(noDash);
  noDash.split(/\s*\/\s*/).forEach((p) => {
    const t = p.trim();
    if (t.length >= 6 && !out.includes(t)) out.push(t);
  });
  return out;
}

function _ensureCompiledGlossary() {
  const vocab = state.enVocabulary || [];
  const gloss = state.enGlossary || [];
  const sig = `${vocab.length}:${gloss.length}:${vocab[0]?.id || 0}:${vocab[0]?.vi_term || ''}`;
  if (sig === _enCompiledSig && _enCompiledRegex) {
    return { regex: _enCompiledRegex, map: _enCompiledMap };
  }
  const map = _enGetTermsDictionary();
  const entries = Array.from(map.values())
    .filter((e) => e.vi.length >= 4)
    .sort((a, b) => b.vi.length - a.vi.length);

  if (!entries.length) {
    _enCompiledRegex = null;
    _enCompiledMap = map;
    _enCompiledSig = sig;
    return { regex: null, map };
  }
  const alts = entries.map((e) => escapeRegExp(escapeHtml(e.vi)));
  try {
    _enCompiledRegex = new RegExp(`(?<![\\p{L}\\p{N}_])(${alts.join('|')})(?![\\p{L}\\p{N}_])`, 'giu');
  } catch (err) {
    _enCompiledRegex = new RegExp(`(${alts.join('|')})`, 'gi');
  }
  _enCompiledMap = map;
  _enCompiledSig = sig;
  return { regex: _enCompiledRegex, map };
}

function _ensureCompiledEnglishTerms() {
  const vocab = state.enVocabulary || [];
  const gloss = state.enGlossary || [];
  const sig = `${vocab.length}:${gloss.length}:${vocab[0]?.id || 0}:${vocab[0]?.en_term || ''}`;
  if (sig === _enEnglishSig && _enEnglishRegex) {
    return { regex: _enEnglishRegex, map: _enEnglishMap };
  }
  const dict = _enGetTermsDictionary();
  const map = new Map();
  dict.forEach((entry) => {
    _enTermVariants(entry.en).forEach((v) => {
      const k = v.toLowerCase();
      if (k.length >= 4 && !map.has(k)) {
        map.set(k, { ...entry, matchEn: v });
      }
    });
  });
  const keys = Array.from(map.keys()).sort((a, b) => b.length - a.length);
  if (!keys.length) {
    _enEnglishRegex = null;
    _enEnglishMap = map;
    _enEnglishSig = sig;
    return { regex: null, map };
  }
  const alts = keys.map((k) => escapeRegExp(escapeHtml(map.get(k).matchEn)));
  try {
    _enEnglishRegex = new RegExp(`(?<![A-Za-z0-9_])(${alts.join('|')})(?![A-Za-z0-9_])`, 'gi');
  } catch (err) {
    _enEnglishRegex = new RegExp(`(${alts.join('|')})`, 'gi');
  }
  _enEnglishMap = map;
  _enEnglishSig = sig;
  return { regex: _enEnglishRegex, map };
}

function decorateTechnicalTermsInHtml(html) {
  if (!html) return html;
  const { regex, map } = _ensureCompiledGlossary();
  if (!regex) return html;
  const parts = String(html).split(/(<button[\s\S]*?<\/button>|<[^>]+>)/gi);
  for (let i = 0; i < parts.length; i += 2) {
    if (!parts[i]) continue;
    parts[i] = parts[i].replace(regex, (m) => {
      const entry = map.get(m.toLowerCase());
      if (!entry) return m;
      return `<span class="en-term-hl" data-lang="vi" data-vi="${escapeHtml(entry.vi)}" data-en="${escapeHtml(entry.en)}" data-cat="${escapeHtml(entry.category || 'TECH')}" data-note="${escapeHtml(entry.note || '')}">${m}</span>`;
    });
  }
  return parts.join('');
}

function decorateEnglishTermsInHtml(html) {
  if (!html) return html;
  const { regex, map } = _ensureCompiledEnglishTerms();
  if (!regex) return html;
  const parts = String(html).split(/(<button[\s\S]*?<\/button>|<span class="en-term-hl"[\s\S]*?<\/span>|<[^>]+>)/gi);
  for (let i = 0; i < parts.length; i += 2) {
    if (!parts[i]) continue;
    parts[i] = parts[i].replace(regex, (m) => {
      const entry = map.get(m.toLowerCase());
      if (!entry) return m;
      return `<span class="en-term-hl" data-lang="en" data-vi="${escapeHtml(entry.vi)}" data-en="${escapeHtml(entry.en)}" data-cat="${escapeHtml(entry.category || 'TECH')}" data-note="${escapeHtml(entry.note || '')}">${m}</span>`;
    });
  }
  return parts.join('');
}

// ---- Global App Language Switcher (Phương án A: 100% UI + 100% Content) ----
function setAppLanguage(lang) {
  const target = lang === 'en' ? 'en' : 'vi';
  if (state.appLang === target) {
    return applyFullAppLocalization();
  }
  state.appLang = target;
  try { localStorage.setItem('mrl-app-lang', target); } catch (e) { /* ignore */ }
  document.documentElement.dataset.lang = target;
  closeEnPopups();
  renderPortalScreen();
  renderHeaderStats();
  syncFlashcardFilterOptions();
  renderAllViews();
  syncEnUiState();
  if (typeof renderStreakBadges === 'function') renderStreakBadges();
  if (typeof _syncAiKeyButtons === 'function') _syncAiKeyButtons();
  const resPromise = applyFullAppLocalization();
  showToast(target === 'en' ? 'Switched to English (100% UI & Content)' : 'Đã chuyển sang Tiếng Việt', 'info');
  return resPromise;
}

function _translateUiLeafNodes(rootEl, toEn) {
  if (!rootEl) return;
  const skipSelector = [
    '#en-selection-popover',
    '#en-hover-tip',
    '#en-vocab-list',
    '.bilingual-sec-wrap',
    '.code-pre',
    '.chip-editing',
    '#ctx-menu',
    '[data-no-i18n="1"]',
    '.detail-canvas-text',
    '.detail-pane .warn-body',
    '.detail-pane .nb-body',
    '#crossref-body .nb-body',
    '#crossref-body .warn-body',
    '.fc-answer .nb-body',
    '.fc-answer .warn-body',
    '.oq-feedback-box .nb-body',
    '.oq-question-txt',
    '.oq-quote-box > div:first-child > div:last-child',
    '.fc-quiz-opt > span:last-child',
    '.coach-prompt-txt',
    '.coach-sample-en',
    '.coach-corrected-box > span',
    '.coach-verdict-txt',
    '.coach-note-list',
    '.coach-vocab-row b',
    '.coach-vocab-row .vb-ipa',
    '#view-en-vocab-bank .row-title',
    '#view-en-vocab-bank .row-sub',
    '#view-en-vocab-bank .d-title',
    '#view-en-vocab-bank .vb-ipa',
    '#view-en-vocab-bank .vb-ex-en',
    '.spec-v',
    '.sop-txt',
    '.sec-title-row > span:first-child',
    '.code-head > span:first-child',
    '.tech-table tbody td:last-child',
    '.fc-question-text',
    '.list-pane .row-title',
    '.list-pane .row-step-count',
    '.detail-pane .d-title',
    'script',
    'style',
  ].join(', ');

  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const p = node.parentElement;
    if (!p || p.closest(skipSelector)) continue;
    if (p.classList.contains('lang-btn') || p.classList.contains('en-vocab-count') || p.classList.contains('d-id') || p.classList.contains('row-id')) continue;
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    if (node._viNodeOrig === undefined || (node._lastSetText !== undefined && node.nodeValue !== node._lastSetText)) {
      node._viNodeOrig = node.nodeValue;
    }
    const orig = node._viNodeOrig;
    if (toEn) {
      const tr = _translateUiString(orig);
      if (tr !== node.nodeValue) node.nodeValue = tr;
    } else if (node.nodeValue !== orig) {
      node.nodeValue = orig;
    }
    node._lastSetText = node.nodeValue;
  }

  rootEl.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((inp) => {
    const cur = inp.getAttribute('placeholder') || '';
    if (inp.dataset.viPh === undefined || (inp.dataset.lastPh !== undefined && cur !== inp.dataset.lastPh)) {
      inp.dataset.viPh = cur;
    }
    const orig = inp.dataset.viPh;
    const next = toEn ? (PLACEHOLDER_I18N_MAP[orig] || orig) : orig;
    if (cur !== next) inp.setAttribute('placeholder', next);
    inp.dataset.lastPh = next;
  });

  rootEl.querySelectorAll('optgroup[label]').forEach((og) => {
    const cur = og.getAttribute('label') || '';
    if (og.dataset.viOg === undefined || (og.dataset.lastOg !== undefined && cur !== og.dataset.lastOg)) {
      og.dataset.viOg = cur;
    }
    const orig = og.dataset.viOg;
    const next = toEn ? _translateUiString(orig) : orig;
    if (cur !== next) og.setAttribute('label', next);
    og.dataset.lastOg = next;
  });

  rootEl.querySelectorAll('option').forEach((opt) => {
    const cur = opt.textContent || '';
    if (opt.dataset.viOpt === undefined || (opt.dataset.lastOpt !== undefined && cur !== opt.dataset.lastOpt)) {
      opt.dataset.viOpt = cur;
    }
    const orig = opt.dataset.viOpt;
    const next = toEn ? _translateUiString(orig) : orig;
    if (cur !== next) opt.textContent = next;
    opt.dataset.lastOpt = next;
  });

  rootEl.querySelectorAll('[title], [aria-label]').forEach((el) => {
    if (el.closest(skipSelector) || el.classList.contains('theme-btn') || el.classList.contains('en-term-hl') || el.classList.contains('lang-btn')) return;
    if (el.hasAttribute('title')) {
      const curT = el.getAttribute('title') || '';
      if (el.dataset.viTitle === undefined || (el.dataset.lastTitle !== undefined && curT !== el.dataset.lastTitle)) {
        el.dataset.viTitle = curT;
      }
      const origT = el.dataset.viTitle;
      const nextT = toEn ? (PLACEHOLDER_I18N_MAP[origT] || _translateUiString(origT)) : origT;
      if (curT !== nextT) el.setAttribute('title', nextT);
      el.dataset.lastTitle = nextT;
    }
    if (el.hasAttribute('aria-label')) {
      const curA = el.getAttribute('aria-label') || '';
      if (el.dataset.viAria === undefined || (el.dataset.lastAria !== undefined && curA !== el.dataset.lastAria)) {
        el.dataset.viAria = curA;
      }
      const origA = el.dataset.viAria;
      const nextA = toEn ? (PLACEHOLDER_I18N_MAP[origA] || _translateUiString(origA)) : origA;
      if (curA !== nextA) el.setAttribute('aria-label', nextA);
      el.dataset.lastAria = nextA;
    }
  });
}

function _renderEnLinesIntoElement(el, lines, applyHighlights = true) {
  const translatedLines = lines.map((line) => {
    if (!line.trim()) return '';
    return _clientViToEnCache.get(line.trim()) || line;
  });
  let html = escapeHtml(translatedLines.join('\n'));
  if (applyHighlights) html = decorateEnglishTermsInHtml(html);
  el.innerHTML = html;
}

async function ensureWorkspaceCategoriesTranslatedToEn() {
  if (state.appLang !== 'en') return false;
  const pools = [
    ...(REPAIR_CATEGORIES || []),
    ...(KNOWLEDGE_GROUPS || []),
    ...(PLC_CATEGORIES || []),
    ...(NETWORK_PROTOCOLS || []),
    ...(ENGLISH_CATEGORIES || []),
  ];
  const pending = [];
  const seen = new Set();
  pools.forEach((it) => {
    if (!it || it.key === 'ALL') return;
    const lbl = String(it.label || it.key || '').trim();
    if (!lbl || seen.has(lbl.toLowerCase())) return;
    seen.add(lbl.toLowerCase());
    if (CATEGORY_LABELS_EN[it.key] || CATEGORY_LABELS_EN[lbl]) return;
    if (typeof _lookupDynamicCategoryEn === 'function' && _lookupDynamicCategoryEn(lbl)) return;
    // Chỉ gọi dịch các nhãn có dấu tiếng Việt hoặc không phải cụm ASCII ngắn chuẩn
    if (/[^\x00-\x7F]/.test(lbl) || lbl.split(/\s+/).length >= 2) {
      pending.push(it);
    }
  });
  if (!pending.length) return false;

  try {
    // Chuyển về lowercase trước khi gửi dịch để Google Translate / Offline engine không hiểu nhầm chữ IN HOA là mã hiệu viết tắt
    const texts = pending.map((it) => String(it.label || it.key || '').trim().toLowerCase());
    const res = await fetch('/api/en/translate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, source_lang: 'vi', target_lang: 'en' }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    let changed = false;
    (data.items || []).forEach((tr, idx) => {
      const it = pending[idx];
      const out = String(tr?.translated_text || '').trim();
      if (it && out) {
        if (typeof _saveDynamicCatEn === 'function') {
          _saveDynamicCatEn(it.label, out);
          _saveDynamicCatEn(it.key, out);
        }
        _clientViToEnCache.set(String(it.label || '').trim(), out);
        _clientViToEnCache.set(String(it.key || '').trim(), out);
        changed = true;
      }
    });
    return changed;
  } catch (e) {
    return false;
  }
}

async function translateVisibleRecordContentToEn() {
  if (state.appLang !== 'en') return;
  const seq = ++_fullTransSeq;

  // Dịch trước các danh mục tùy biến (VD: KIẾN THỨC CẦN HIỂU, BÀI TẬP THỰC HÀNH...) rồi cập nhật lại thanh chip & sidebar ngay lập tức
  const catsChanged = await ensureWorkspaceCategoriesTranslatedToEn();
  if (seq !== _fullTransSeq || state.appLang !== 'en') return;
  if (catsChanged) {
    if (typeof syncWorkspaceCategoriesFromState === 'function') syncWorkspaceCategoriesFromState(state.workspaceCategories);
    if (typeof renderHeaderStats === 'function') renderHeaderStats();
    if (typeof syncFlashcardFilterOptions === 'function') syncFlashcardFilterOptions();
    if (typeof renderRepairsView === 'function') renderRepairsView();
    if (typeof renderKnowledgeView === 'function') renderKnowledgeView();
    if (typeof renderPlcView === 'function') renderPlcView();
    if (typeof renderNetworkView === 'function') renderNetworkView();
    if (typeof renderEnVocabBankView === 'function') renderEnVocabBankView();
    _translateUiLeafNodes(document.getElementById('app-shell'), true);
    _translateUiLeafNodes(document.getElementById('portal-screen'), true);
  }

  const isEnFlashcard = state.activeTab === 'flashcards' && (state.flashcard.mode === 'en_vocab' || state.flashcard.mode === 'en_quiz');
  const selectors = [
    '#app-shell .list-pane .row-title',
    '#app-shell .list-pane .row-step-count',
    '#app-shell .detail-pane .d-title',
    '#app-shell .detail-pane .detail-canvas-text',
    '#app-shell .detail-pane .warn-body',
    '#app-shell .detail-pane .nb-body',
    '#app-shell .detail-pane .spec-v',
    '#app-shell .detail-pane .sop-txt',
    '#app-shell .detail-pane .sec-title-row > span:first-child',
    '#app-shell .detail-pane .code-head > span:first-child',
    '#app-shell .detail-pane .tech-table tbody td:last-child',
    '#view-en-quiz .oq-feedback-box .nb-body',
    '#view-en-coach .coach-verdict-txt',
    '#view-en-coach .coach-note-list li',
    ...(!isEnFlashcard ? ['#flashcard-stage .d-title', '#flashcard-stage .fc-question-text', '#flashcard-stage .fc-answer .nb-body', '#flashcard-stage .fc-quiz-opt > span:last-child'] : []),
  ];

  const targets = [];
  document.querySelectorAll(selectors.join(', ')).forEach((el) => {
    if (el.closest('.hidden') || el.closest('#view-en-vocab-bank') || el.querySelector('.inline-empty-prompt') || el.closest('.bilingual-sec-wrap')) return;
    if (el.classList.contains('row-step-count') && el.closest('#plc-list, #network-list')) return;
    if (el.dataset.viHtmlOrig === undefined) {
      el.dataset.viHtmlOrig = el.innerHTML;
      el.dataset.viTextOrig = el.textContent || '';
    }
    const rawText = (el.dataset.viTextOrig || '').trim();
    if (!rawText) return;
    const isMultiLine = el.classList.contains('detail-canvas-text') || el.classList.contains('warn-body') || el.classList.contains('nb-body') || el.classList.contains('spec-v') || el.classList.contains('fc-question-text');
    const lines = isMultiLine ? String(el.dataset.viTextOrig).split('\n') : [rawText];
    targets.push({ el, lines, isPlainTitle: el.classList.contains('row-title') || el.classList.contains('row-step-count') || el.classList.contains('d-title') || el.tagName === 'SPAN' || el.tagName === 'LI' });
  });

  const missingSet = new Set();
  targets.forEach((t) => {
    t.lines.forEach((l) => {
      const k = l.trim();
      if (k && !_clientViToEnCache.has(k)) missingSet.add(k);
    });
  });

  // Render any cached targets immediately (0ms)
  targets.forEach((t) => {
    const allHit = t.lines.every((l) => !l.trim() || _clientViToEnCache.has(l.trim()));
    if (allHit) {
      _renderEnLinesIntoElement(t.el, t.lines, !t.isPlainTitle);
    }
  });

  const missing = Array.from(missingSet);
  if (!missing.length) return;

  try {
    for (let i = 0; i < missing.length; i += 80) {
      const chunk = missing.slice(i, i + 80);
      const res = await fetch('/api/en/translate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: chunk, source_lang: 'vi', target_lang: 'en' }),
      });
      if (!res.ok) break;
      const data = await res.json();
      (data.items || []).forEach((it, idx) => {
        const src = chunk[idx];
        if (src && it?.translated_text) {
          _clientViToEnCache.set(src, it.translated_text);
        }
      });
    }
    if (seq !== _fullTransSeq || state.appLang !== 'en') return;
    targets.forEach((t) => {
      if (document.contains(t.el)) {
        _renderEnLinesIntoElement(t.el, t.lines, !t.isPlainTitle);
      }
    });
  } catch (err) {
    /* ignore */
  }
}

function applyFullAppLocalization() {
  const isEn = state.appLang === 'en';
  document.documentElement.dataset.lang = isEn ? 'en' : 'vi';
  document.querySelectorAll('[data-lang-btn]').forEach((b) => {
    b.classList.toggle('active', b.getAttribute('data-lang-btn') === (isEn ? 'en' : 'vi'));
  });

  _translateUiLeafNodes(document.getElementById('portal-screen'), isEn);
  _translateUiLeafNodes(document.getElementById('app-shell'), isEn);
  [
    'category-manager-modal',
    'en-vocab-modal',
    'en-vocab-edit-modal',
    'en-ai-config-modal',
    'repair-modal',
    'knowledge-modal',
    'plc-modal',
    'network-modal',
    'crossref-overlay',
  ].forEach((id) => _translateUiLeafNodes(document.getElementById(id), isEn));

  document.querySelectorAll('.theme-btn').forEach((b) => {
    const isLightNow = document.documentElement.dataset.theme === 'light';
    const label = isEn
      ? (isLightNow ? 'Dark Mode' : 'Light Mode')
      : (isLightNow ? 'Chế độ tối' : 'Chế độ sáng');
    b.textContent = (isLightNow ? '◑ ' : '◐ ') + label;
    b.title = `${label} (Ctrl+Shift+L)`;
    b.setAttribute('aria-label', `${label} (Ctrl+Shift+L)`);
  });

  document.querySelectorAll('.en-vocab-pill-lbl').forEach((el) => {
    el.textContent = isEn ? 'Vocab' : 'Từ vựng';
  });

  if (!isEn) {
    document.querySelectorAll('[data-vi-html-orig]').forEach((el) => {
      if (el.dataset.viHtmlOrig !== undefined && el.innerHTML !== el.dataset.viHtmlOrig) {
        el.innerHTML = el.dataset.viHtmlOrig;
      }
    });
    return Promise.resolve();
  }
  return translateVisibleRecordContentToEn();
}

// ---- Sync UI State & Mode Toggle ----
function syncEnUiState() {
  const on = Boolean(state.enMode);
  const isEn = state.appLang === 'en';
  document.documentElement.classList.toggle('en-mode-on', on);
  ['btn-en-mode', 'portal-btn-en-mode'].forEach((id) => {
    const b = document.getElementById(id);
    if (!b) return;
    b.classList.toggle('split-on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = isEn
      ? (on ? '🇬🇧 Study: ON' : '🇬🇧 Study: OFF')
      : (on ? '🇬🇧 EN: BẬT' : '🇬🇧 EN: TẮT');
    b.title = isEn
      ? 'Toggle selection translation & term hover helper'
      : (on
        ? 'Đang BẬT học Tiếng Anh (quét chữ để dịch, gạch chân thuật ngữ). Bấm để tắt.'
        : 'Đang TẮT tự động hiện ô dịch. Bấm để bật chế độ học Tiếng Anh song ngữ.');
  });
  const count = String((state.englishCards || []).length || (state.enVocabulary || []).length);
  document.querySelectorAll('.en-vocab-count').forEach((el) => {
    el.textContent = count;
  });
  if (document.getElementById('en-vocab-modal') && !document.getElementById('en-vocab-modal').classList.contains('hidden')) {
    renderVocabModalList();
  }
}

function toggleEnMode() {
  state.enMode = !state.enMode;
  try { localStorage.setItem('mrl-en-mode', state.enMode ? '1' : '0'); } catch (e) { /* ignore */ }
  if (!state.enMode) closeEnPopups();
  syncEnUiState();
  showToast(
    state.appLang === 'en'
      ? (state.enMode ? 'Selection & Hover Translator ON' : 'Selection & Hover Translator OFF')
      : (state.enMode ? 'Đã BẬT quét chữ dịch & gạch chân thuật ngữ' : 'Đã TẮT tự động bật ô dịch'),
    'info'
  );
}

let _cachedEnVoices = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const _refreshVoices = () => {
    try { _cachedEnVoices = window.speechSynthesis.getVoices() || []; } catch (_) {}
  };
  _refreshVoices();
  try { window.speechSynthesis.addEventListener?.('voiceschanged', _refreshVoices); } catch (_) {}
}

function speakEnglishText(text, rate = 0.94) {
  const clean = String(text || '')
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return;
  if (!('speechSynthesis' in window)) {
    showToast('SpeechSynthesis is not available in this browser', 'info');
    return;
  }
  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      try { window.speechSynthesis.resume(); } catch (_) {}
    }
    const utter = new SpeechSynthesisUtterance(clean);
    const voices = (window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : []) || [];
    const pool = voices.length ? voices : _cachedEnVoices;
    const enVoice = pool.find((v) => /^en-US/i.test(v.lang))
      || pool.find((v) => /^en-GB/i.test(v.lang))
      || pool.find((v) => /^en/i.test(v.lang));
    if (enVoice) utter.voice = enVoice;
    utter.lang = enVoice?.lang || 'en-US';
    utter.rate = Math.max(0.5, Math.min(1.5, Number(rate) || 0.94));
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    showToast('Audio playback failed', 'error');
  }
}

function _isSavedVocab(viTerm) {
  const target = String(viTerm || '').trim().toLowerCase();
  return (state.enVocabulary || []).some((v) => String(v.vi_term || '').trim().toLowerCase() === target);
}

function _activeRecordContextId() {
  if (!state.activeWorkspace) return '';
  if (state.activeTab === 'repairs') return state.selectedRepairId || 'MRL';
  if (state.activeTab === 'knowledge') return state.selectedKnowledgeId || 'SOP';
  if (state.activeTab === 'plc') return state.selectedPlcId || 'PLC';
  if (state.activeTab === 'network') return state.selectedNetworkId || 'NET';
  return state.activeWorkspace.toUpperCase();
}

function _activeVocabCategoryDefault() {
  if (state.activeWorkspace === 'plc') return 'PLC';
  if (state.activeWorkspace === 'network') return 'NET';
  if (state.activeWorkspace === 'mrl') return 'REPAIR';
  return 'TECH';
}

async function saveToEnVocabulary(item) {
  const vi = String(item?.vi || '').trim();
  const en = String(item?.en || '').trim();
  if (!vi || !en) {
    showToast(state.appLang === 'en' ? 'Need both Vietnamese and English text to save' : 'Cần cả nội dung Tiếng Việt và Tiếng Anh để lưu', 'error');
    return null;
  }
  try {
    const res = await fetch('/api/en/vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vi_term: vi,
        en_term: en,
        category: String(item.category || _activeVocabCategoryDefault()).toUpperCase(),
        example_vi: item.example_vi || '',
        example_en: item.example_en || '',
        source_ref: item.source_ref || _activeRecordContextId(),
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.detail || 'Save vocabulary failed');
    }
    const data = await res.json();
    state.enVocabulary = data.en_vocabulary || state.enVocabulary;
    if (Array.isArray(data.english_vocab)) state.englishVocab = data.english_vocab;
    syncEnUiState();
    if (typeof renderHeaderStats === 'function') renderHeaderStats();
    if (state.activeTab === 'en-vocab-bank' && typeof renderEnVocabBankView === 'function') renderEnVocabBankView();
    showToast(`⭐ "${vi}" ⇄ "${en}"`, 'success');
    return data.item;
  } catch (err) {
    showToast(err.message, 'error');
    return null;
  }
}

async function deleteEnVocabItem(vocabId) {
  try {
    const res = await fetch(`/api/en/vocabulary/${encodeURIComponent(vocabId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete vocabulary failed');
    const data = await res.json();
    state.enVocabulary = data.en_vocabulary || [];
    if (Array.isArray(data.english_vocab)) state.englishVocab = data.english_vocab;
    syncEnUiState();
    if (typeof renderHeaderStats === 'function') renderHeaderStats();
    if (state.activeTab === 'en-vocab-bank' && typeof renderEnVocabBankView === 'function') renderEnVocabBankView();
    showToast(state.appLang === 'en' ? 'Removed from Vocabulary' : 'Đã xóa khỏi Sổ từ vựng', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function translateAndSpeakVi(viText) {
  try {
    const res = await fetch('/api/en/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: viText, source_lang: 'auto', target_lang: 'auto' }),
    });
    if (!res.ok) throw new Error('Translate failed');
    const data = await res.json();
    if (data.en) speakEnglishText(data.en);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function isEnPopupOpen() {
  const pop = document.getElementById('en-selection-popover');
  const tip = document.getElementById('en-hover-tip');
  return Boolean((pop && !pop.classList.contains('hidden')) || (tip && !tip.classList.contains('hidden')));
}

function closeEnPopups() {
  document.getElementById('en-selection-popover')?.classList.add('hidden');
  document.getElementById('en-hover-tip')?.classList.add('hidden');
  document.getElementById('en-mobile-sel-btn')?.classList.add('hidden');
}

function _positionFloatingBox(boxEl, anchorRect, preferAbove = false) {
  if (!boxEl) return;
  const bw = boxEl.offsetWidth || 360;
  const bh = boxEl.offsetHeight || 180;
  const pad = 10;
  const r = anchorRect || { left: 100, right: 200, top: 100, bottom: 120 };
  let left = Math.max(pad, Math.min(r.left, window.innerWidth - bw - pad));
  let top = preferAbove ? (r.top - bh - 8) : (r.bottom + 8);
  if (preferAbove && top < pad) top = r.bottom + 8;
  if (!preferAbove && top + bh > window.innerHeight - pad) {
    const altTop = r.top - bh - 8;
    top = altTop >= pad ? altTop : Math.max(pad, window.innerHeight - bh - pad);
  }
  top = Math.max(pad, Math.min(top, window.innerHeight - bh - pad));
  boxEl.style.left = `${Math.round(left)}px`;
  boxEl.style.top = `${Math.round(top)}px`;
}

// ---- Feature 1 (Bidirectional): Selection Translator Popover (VI -> EN & EN -> VI) ----
function _renderSelectionPopoverBody(popEl, data, sourceRef, anchorRect) {
  if (!popEl) return;
  _enLastSelectionPayload = { ...data, sourceRef, anchorRect };
  const terms = Array.isArray(data.terms) ? data.terms : [];
  const isEnToVi = data.target_lang === 'vi';
  const mainSaved = _isSavedVocab(data.vi);

  const srcTag = isEnToVi ? 'EN' : 'VI';
  const dstTag = isEnToVi ? 'VI' : 'EN';
  const srcText = isEnToVi ? (data.source_text || data.en) : (data.source_text || data.vi);
  const dstText = isEnToVi ? (data.translated_text || data.vi) : (data.translated_text || data.en);

  const headTitle = isEnToVi
    ? (state.appLang === 'en' ? '🇻🇳 EN → VI TRANSLATION' : '🇻🇳 DỊCH ANH → VIỆT (EN → VI)')
    : (state.appLang === 'en' ? '🇬🇧 VI → EN TRANSLATION' : '🇬🇧 DỊCH VIỆT → ANH (VI → EN)');

  const termsHtml = terms.length
    ? `<div class="en-pop-terms">
         <div class="en-pop-subhead">${state.appLang === 'en' ? `TECHNICAL TERMS (${terms.length})` : `THUẬT NGỮ CHUYÊN NGÀNH TRONG ĐOẠN (${terms.length})`}</div>
         <div class="en-term-chips">
           ${terms.map((t, idx) => {
             const saved = _isSavedVocab(t.vi_canon || t.vi);
             const leftTxt = isEnToVi ? t.en : t.vi;
             const rightTxt = isEnToVi ? t.vi : t.en;
             return `
               <div class="en-term-row">
                 <div class="en-term-pair">
                   <span class="en-cat-badge">${escapeHtml(t.category || 'TECH')}</span>
                   <span class="en-vi-txt">${escapeHtml(leftTxt)}</span>
                   <span class="en-arrow">→</span>
                   <b class="en-en-txt">${escapeHtml(rightTxt)}</b>
                 </div>
                 <div class="en-term-acts">
                   <button type="button" class="btn btn-sm" data-en-speak-term="${idx}" title="Pronounce English">🔊</button>
                   <button type="button" class="btn btn-sm ${saved ? 'btn-green' : ''}" data-en-save-term="${idx}" title="Save to Vocabulary">${saved ? '✓' : '⭐'}</button>
                 </div>
               </div>`;
           }).join('')}
         </div>
       </div>`
    : '';

  popEl.innerHTML = `
    <div class="en-pop-head">
      <span class="en-pop-title">${headTitle}</span>
      <div class="en-pop-head-acts">
        <button type="button" class="btn btn-sm" id="en-pop-swap-dir" title="Đảo chiều dịch VI ⇄ EN">⇄</button>
        <button type="button" class="btn btn-sm" id="en-pop-speak-main" title="Listen in English">🔊 EN</button>
        <button type="button" class="btn btn-sm" id="en-pop-copy-main" title="Copy Translation">📋</button>
        <button type="button" class="btn btn-sm ${mainSaved ? 'btn-green' : 'btn-primary'}" id="en-pop-save-main" title="Save to Vocabulary">${mainSaved ? '✓' : '⭐ Lưu'}</button>
        <button type="button" class="ov-x" id="en-pop-close-btn" title="Close (Esc)">×</button>
      </div>
    </div>
    <div class="en-pop-body">
      <div class="en-pop-block vi">
        <span class="en-lang-tag">${srcTag}</span>
        <div class="en-pop-txt">${escapeHtml(srcText)}</div>
      </div>
      <div class="en-pop-block en">
        <span class="en-lang-tag en">${dstTag}</span>
        <div class="en-pop-txt en">${escapeHtml(dstText)}</div>
      </div>
      ${termsHtml}
    </div>`;

  popEl.querySelector('#en-pop-close-btn')?.addEventListener('click', () => popEl.classList.add('hidden'));
  popEl.querySelector('#en-pop-swap-dir')?.addEventListener('click', () => {
    const nextTarget = isEnToVi ? 'en' : 'vi';
    openSelectionTranslatorForText(srcText, anchorRect, sourceRef, nextTarget);
  });
  popEl.querySelector('#en-pop-speak-main')?.addEventListener('click', () => speakEnglishText(data.en || srcText));
  popEl.querySelector('#en-pop-copy-main')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard?.writeText?.(dstText);
      showToast(state.appLang === 'en' ? 'Copied translation' : 'Đã sao chép bản dịch', 'success');
    } catch (err) {
      showToast('Copy failed', 'error');
    }
  });
  popEl.querySelector('#en-pop-save-main')?.addEventListener('click', async (ev) => {
    const saved = await saveToEnVocabulary({
      vi: data.vi,
      en: data.en,
      category: terms[0]?.category || _activeVocabCategoryDefault(),
      example_vi: data.vi,
      example_en: data.en,
      source_ref: sourceRef || _activeRecordContextId(),
    });
    if (saved) {
      ev.currentTarget.textContent = '✓';
      ev.currentTarget.classList.remove('btn-primary');
      ev.currentTarget.classList.add('btn-green');
    }
  });
  popEl.querySelectorAll('[data-en-speak-term]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = terms[Number(btn.getAttribute('data-en-speak-term'))];
      if (t) speakEnglishText(t.en);
    });
  });
  popEl.querySelectorAll('[data-en-save-term]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      const t = terms[Number(btn.getAttribute('data-en-save-term'))];
      if (!t) return;
      const saved = await saveToEnVocabulary({
        vi: t.vi_canon || t.vi,
        en: t.en,
        category: t.category || _activeVocabCategoryDefault(),
        example_vi: data.vi,
        example_en: data.en,
        source_ref: sourceRef || _activeRecordContextId(),
      });
      if (saved) {
        ev.currentTarget.textContent = '✓';
        ev.currentTarget.classList.add('btn-green');
      }
    });
  });

  if (anchorRect) _positionFloatingBox(popEl, anchorRect, false);
}

async function openSelectionTranslatorForText(text, anchorRect, sourceRef = '', forceTargetLang = 'auto') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 2) return;
  const popEl = document.getElementById('en-selection-popover');
  if (!popEl) return;

  const seq = ++_enSelReqSeq;
  popEl.innerHTML = `
    <div class="en-pop-head">
      <span class="en-pop-title">${state.appLang === 'en' ? '🌐 TRANSLATING...' : '🌐 ĐANG DỊCH SONG NGỮ...'}</span>
      <button type="button" class="ov-x" id="en-pop-loading-close">×</button>
    </div>
    <div class="en-pop-body">
      <div class="en-pop-block vi"><span class="en-lang-tag">...</span><div class="en-pop-txt">${escapeHtml(clean.slice(0, 260))}</div></div>
    </div>`;
  popEl.querySelector('#en-pop-loading-close')?.addEventListener('click', () => popEl.classList.add('hidden'));
  popEl.classList.remove('hidden');
  _positionFloatingBox(popEl, anchorRect, false);

  try {
    const res = await fetch('/api/en/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, source_lang: 'auto', target_lang: forceTargetLang }),
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    if (seq !== _enSelReqSeq) return;
    _renderSelectionPopoverBody(popEl, data, sourceRef, anchorRect);
  } catch (err) {
    if (seq !== _enSelReqSeq) return;
    popEl.querySelector('.en-pop-body').innerHTML = `<div style="color:var(--red);font-size:12px;">${escapeHtml(err.message)}</div>`;
  }
}

// ---- Feature 3 (Bidirectional): Instant Hover Tooltip on .en-term-hl ----
function _showHoverTipForSpan(span) {
  const tip = document.getElementById('en-hover-tip');
  if (!tip || !span || (!state.enMode && state.appLang !== 'en')) return;
  clearTimeout(_enHoverHideTimer);
  const langAttr = span.getAttribute('data-lang') || (state.appLang === 'en' ? 'en' : 'vi');
  const vi = span.getAttribute('data-vi') || '';
  const en = span.getAttribute('data-en') || '';
  const cat = span.getAttribute('data-cat') || 'TECH';
  const note = span.getAttribute('data-note') || '';
  if (!en || !vi) return;
  const saved = _isSavedVocab(vi);

  const isEnSource = langAttr === 'en';
  const topTerm = isEnSource ? en : vi;
  const mainTranslation = isEnSource ? `🇻🇳 ${vi}` : `🇬🇧 ${en}`;

  tip.innerHTML = `
    <div class="en-tip-top">
      <span class="en-cat-badge">${escapeHtml(cat)}</span>
      <span class="en-tip-vi">${escapeHtml(topTerm)}</span>
      <button type="button" class="ov-x" id="en-tip-close" title="Close" style="margin-left:auto;">×</button>
    </div>
    <div class="en-tip-en">${escapeHtml(mainTranslation)}</div>
    ${note ? `<div class="en-tip-note">${escapeHtml(note)}</div>` : ''}
    <div class="en-tip-acts">
      <button type="button" class="btn btn-sm" id="en-tip-speak">🔊 ${state.appLang === 'en' ? 'Listen' : 'Nghe'}</button>
      <button type="button" class="btn btn-sm ${saved ? 'btn-green' : 'btn-primary'}" id="en-tip-save">${saved ? (state.appLang === 'en' ? '✓ Saved' : '✓ Đã lưu') : (state.appLang === 'en' ? '⭐ Save' : '⭐ Lưu từ vựng')}</button>
    </div>`;

  tip.querySelector('#en-tip-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    tip.classList.add('hidden');
  });
  tip.querySelector('#en-tip-speak')?.addEventListener('click', (e) => {
    e.stopPropagation();
    speakEnglishText(en);
  });
  tip.querySelector('#en-tip-save')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const res = await saveToEnVocabulary({
      vi, en, category: cat, example_vi: '', example_en: note || '', source_ref: _activeRecordContextId(),
    });
    if (res) {
      e.currentTarget.textContent = state.appLang === 'en' ? '✓ Saved' : '✓ Đã lưu';
      e.currentTarget.classList.remove('btn-primary');
      e.currentTarget.classList.add('btn-green');
    }
  });

  tip.classList.remove('hidden');
  _positionFloatingBox(tip, span.getBoundingClientRect(), true);
}

// ---- Feature 2: Section & Record Bilingual View ----
function _buildBilingualBoxHtml(titleEn, rows, terms = [], contextId = '') {
  const rowsHtml = rows.map((r, idx) => {
    const saved = _isSavedVocab(r.vi);
    return `
      <div class="bilingual-row">
        <div class="bi-col vi">${escapeHtml(r.vi)}</div>
        <div class="bi-col en">
          <div class="bi-en-txt">${escapeHtml(r.en)}</div>
          <div class="bi-row-acts">
            <button type="button" class="btn btn-sm" data-bi-speak="${idx}" title="Listen English">🔊</button>
            <button type="button" class="btn btn-sm ${saved ? 'btn-green' : ''}" data-bi-save="${idx}" title="Save to Vocabulary">${saved ? '✓' : '⭐'}</button>
          </div>
        </div>
      </div>`;
  }).join('');

  const uniqueTerms = [];
  const seen = new Set();
  (terms || []).forEach((t) => {
    const k = String(t.vi_canon || t.vi || '').toLowerCase();
    if (k && !seen.has(k)) {
      seen.add(k);
      uniqueTerms.push(t);
    }
  });

  const termsBar = uniqueTerms.length
    ? `<div class="bi-terms-bar">
         <span class="bi-terms-lbl">${state.appLang === 'en' ? 'KEY TERMS:' : 'THUẬT NGỮ TRONG KHỐI:'}</span>
         ${uniqueTerms.slice(0, 10).map((t) =>
           `<button type="button" class="tag tag-comp" data-bi-term-en="${escapeHtml(t.en)}" data-bi-term-vi="${escapeHtml(t.vi_canon || t.vi)}" data-bi-term-cat="${escapeHtml(t.category || 'TECH')}" title="Listen: ${escapeHtml(t.en)}">🇬🇧 ${escapeHtml(t.vi)} → ${escapeHtml(t.en)}</button>`
         ).join('')}
       </div>`
    : '';

  return `
    <div class="bilingual-head">
      <span>🇬🇧 ${state.appLang === 'en' ? 'BILINGUAL COMPARISON (VI ⇄ EN)' : 'ĐỐI CHIẾU SONG NGỮ (VI ⇄ TECHNICAL EN)'}${titleEn ? ` — ${escapeHtml(titleEn)}` : ''}</span>
      <button type="button" class="btn btn-sm" data-bi-speak-all="1" title="Play all English">🔊 ${state.appLang === 'en' ? 'Listen All' : 'Nghe cả đoạn'}</button>
    </div>
    <div class="bilingual-grid">${rowsHtml}</div>
    ${termsBar}`;
}

function _bindBilingualContainerEvents(boxEl, titleEn, rows, contextId) {
  if (!boxEl) return;
  boxEl.querySelectorAll('[data-bi-speak]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const r = rows[Number(btn.getAttribute('data-bi-speak'))];
      if (r) speakEnglishText(r.en);
    });
  });
  boxEl.querySelectorAll('[data-bi-save]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const r = rows[Number(btn.getAttribute('data-bi-save'))];
      if (!r) return;
      const saved = await saveToEnVocabulary({
        vi: r.vi,
        en: r.en,
        category: r.terms?.[0]?.category || _activeVocabCategoryDefault(),
        example_vi: r.vi,
        example_en: r.en,
        source_ref: contextId || _activeRecordContextId(),
      });
      if (saved) {
        btn.textContent = '✓';
        btn.classList.add('btn-green');
      }
    });
  });
  boxEl.querySelector('[data-bi-speak-all]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    speakEnglishText(rows.map((r) => r.en).join('. '));
  });
  boxEl.querySelectorAll('[data-bi-term-en]').forEach((tag) => {
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      speakEnglishText(tag.getAttribute('data-bi-term-en'));
    });
  });
}

function renderCachedBilingualSectionHtml(secKey) {
  const entry = state.bilingualSections?.[secKey];
  if (!entry || !entry.rows) return '';
  return _buildBilingualBoxHtml(entry.titleEn, entry.rows, entry.allTerms || [], entry.recordId || '');
}

async function toggleSectionBilingual(secKey, forceOpen = null) {
  const box = document.getElementById(`bilingual-box-${secKey}`);
  const btn = document.querySelector(`[data-bi-key="${CSS.escape(secKey)}"]`);
  const existing = state.bilingualSections[secKey];
  const wantOpen = forceOpen !== null ? Boolean(forceOpen) : !(existing?.open);

  if (!wantOpen) {
    if (existing) existing.open = false;
    if (box) box.classList.add('hidden');
    if (btn) btn.classList.remove('split-on');
    return;
  }

  const raw = sectionRawTextMap[secKey];
  if (!raw || (!(raw.content || '').trim() && !(raw.title || '').trim())) {
    showToast(state.appLang === 'en' ? 'Section is empty' : 'Khối này chưa có nội dung để dịch', 'info');
    return;
  }

  if (existing?.rows) {
    existing.open = true;
    if (box) {
      box.innerHTML = _buildBilingualBoxHtml(existing.titleEn, existing.rows, existing.allTerms, raw.recordId);
      box.classList.remove('hidden');
      _bindBilingualContainerEvents(box, existing.titleEn, existing.rows, raw.recordId);
    }
    if (btn) btn.classList.add('split-on');
    return;
  }

  if (btn) btn.classList.add('split-on');
  if (box) {
    box.classList.remove('hidden');
    box.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:var(--text-3);">🇬🇧 ${state.appLang === 'en' ? 'Loading bilingual block...' : 'Đang dịch khối nội dung sang Tiếng Anh chuyên ngành...'}</div>`;
  }

  const lines = String(raw.content || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const texts = [raw.title || '', ...lines].filter(Boolean);

  try {
    const res = await fetch('/api/en/translate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, source_lang: 'vi', target_lang: 'en' }),
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    const translated = data.items || [];
    const titleEn = raw.title ? (translated[0]?.en || '') : '';
    const rows = raw.title ? translated.slice(1) : translated;
    const allTerms = translated.flatMap((x) => x.terms || []);

    state.bilingualSections[secKey] = { open: true, titleEn, rows, allTerms, recordId: raw.recordId || '' };
    if (box) {
      box.innerHTML = _buildBilingualBoxHtml(titleEn, rows, allTerms, raw.recordId);
      _bindBilingualContainerEvents(box, titleEn, rows, raw.recordId);
    }
  } catch (err) {
    if (btn) btn.classList.remove('split-on');
    if (box) box.classList.add('hidden');
    showToast(err.message, 'error');
  }
}

async function _toggleCustomHostBilingual(hostId, title, lines, recordId) {
  const host = document.getElementById(hostId);
  if (!host) return;
  if (!host.classList.contains('hidden')) {
    host.classList.add('hidden');
    return;
  }
  const cacheKey = hostId;
  if (_enRecordBilingualCache[cacheKey]) {
    const c = _enRecordBilingualCache[cacheKey];
    host.innerHTML = _buildBilingualBoxHtml(title, c.rows, c.allTerms, recordId);
    host.classList.remove('hidden');
    _bindBilingualContainerEvents(host, title, c.rows, recordId);
    return;
  }
  const cleanLines = lines.map((l) => String(l || '').trim()).filter(Boolean);
  if (!cleanLines.length) {
    showToast(state.appLang === 'en' ? 'No text content to translate' : 'Bài viết chưa có nội dung văn bản để dịch', 'info');
    return;
  }
  host.classList.remove('hidden');
  host.innerHTML = `<div style="padding:10px 12px;font-size:12px;color:var(--text-3);">🇬🇧 ${state.appLang === 'en' ? 'Loading bilingual breakdown...' : 'Đang dịch toàn bài sang Tiếng Anh chuyên ngành...'}</div>`;
  try {
    const res = await fetch('/api/en/translate-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: cleanLines, source_lang: 'vi', target_lang: 'en' }),
    });
    if (!res.ok) throw new Error('Translation failed');
    const data = await res.json();
    const rows = data.items || [];
    const allTerms = rows.flatMap((x) => x.terms || []);
    _enRecordBilingualCache[cacheKey] = { rows, allTerms };
    host.innerHTML = _buildBilingualBoxHtml(title, rows, allTerms, recordId);
    _bindBilingualContainerEvents(host, title, rows, recordId);
  } catch (err) {
    host.classList.add('hidden');
    showToast(err.message, 'error');
  }
}

async function toggleCurrentRecordBilingual(explicitKind = null, explicitId = null) {
  const kind = explicitKind || (
    state.activeTab === 'repairs' ? 'repair'
      : state.activeTab === 'knowledge' ? 'knowledge'
      : state.activeTab === 'plc' ? 'plc'
      : state.activeTab === 'network' ? 'network' : ''
  );
  if (!kind) return;

  if (kind === 'repair') {
    const id = explicitId || state.selectedRepairId;
    const c = state.repairCases.find((x) => x.id === id);
    if (!c) return;
    const steps = c.steps && c.steps.length ? c.steps : [{ step_order: 1, symptom: c.fault_symptom_raw, root_cause: c.root_cause_raw, solution: c.solution_raw }];
    const lines = [c.brand_model];
    if (c.note) lines.push(`Lưu ý: ${c.note}`);
    steps.forEach((s, idx) => {
      if (s.symptom) lines.push(`Bước ${idx + 1} - Hiện tượng: ${s.symptom}`);
      if (s.root_cause) lines.push(`Bước ${idx + 1} - Nguyên nhân: ${s.root_cause}`);
      if (s.solution) lines.push(`Bước ${idx + 1} - Cách xử lý: ${s.solution}`);
    });
    await _toggleCustomHostBilingual(`repair-bilingual-host-${id}`, c.id, lines, c.id);
    return;
  }

  if (kind === 'knowledge') {
    const id = explicitId || state.selectedKnowledgeId;
    const k = state.knowledgeItems.find((x) => x.id === id);
    if (!k) return;
    const lines = [k.topic_model, k.key_takeaway, k.core_concept_workflow, k.why_question, k.actionable_application, k.note].filter(Boolean);
    if (lines.length) await _toggleCustomHostBilingual(`knowledge-bilingual-host-${id}`, k.id, lines, k.id);
    const secKeys = Object.keys(sectionRawTextMap).filter((sk) => sk.startsWith(`knw:${id}:`));
    const allOpen = secKeys.length > 0 && secKeys.every((sk) => state.bilingualSections[sk]?.open);
    await Promise.all(secKeys.map((sk) => toggleSectionBilingual(sk, !allOpen)));
    return;
  }

  const id = explicitId || (kind === 'plc' ? state.selectedPlcId : state.selectedNetworkId);
  const prefix = kind === 'plc' ? `plc:${id}:` : `net:${id}:`;
  const secKeys = Object.keys(sectionRawTextMap).filter((sk) => sk.startsWith(prefix) && (sectionRawTextMap[sk]?.content || '').trim());
  if (!secKeys.length) {
    showToast(state.appLang === 'en' ? 'No text content to translate' : 'Bài viết chưa có nội dung để dịch song ngữ', 'info');
    return;
  }
  const allOpen = secKeys.every((sk) => state.bilingualSections[sk]?.open);
  await Promise.all(secKeys.map((sk) => toggleSectionBilingual(sk, !allOpen)));
}

// ---- Feature 4: Technical Vocabulary Notebook Modal & English Flashcard / Quiz ----
function openVocabModal() {
  const modal = document.getElementById('en-vocab-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderVocabModalList();
}

function closeVocabModal() {
  document.getElementById('en-vocab-modal')?.classList.add('hidden');
}

function renderVocabModalList() {
  const listEl = document.getElementById('en-vocab-list');
  if (!listEl) return;
  const q = (document.getElementById('en-vocab-search')?.value || '').trim().toLowerCase();
  const catFilter = document.getElementById('en-vocab-cat-filter')?.value || 'ALL';
  const items = (state.enVocabulary || []).filter((v) => {
    if (catFilter !== 'ALL' && String(v.category || '').toUpperCase() !== catFilter) return false;
    if (q) {
      const hay = `${v.vi_term} ${v.en_term} ${v.category} ${v.example_vi} ${v.example_en} ${v.source_ref}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!items.length) {
    listEl.innerHTML = `<div class="empty" style="padding:28px;">${state.appLang === 'en' ? 'NO MATCHING VOCABULARY FOUND' : 'CHƯA CÓ TỪ VỰNG PHÙ HỢP — HÃY QUÉT CHỮ HOẶC THÊM TỪ MỚI Ở TRÊN'}</div>`;
    return;
  }

  listEl.innerHTML = items.map((v) => `
    <div class="vocab-row">
      <div class="vocab-main">
        <div class="vocab-head">
          <span class="en-cat-badge">${escapeHtml(v.category || 'TECH')}</span>
          <b class="vocab-vi">${escapeHtml(v.vi_term)}</b>
          <span class="en-arrow">⇄</span>
          <b class="vocab-en">${escapeHtml(v.en_term)}</b>
          ${v.source_ref ? `<span class="d-id" style="margin-left:auto;">${escapeHtml(v.source_ref)}</span>` : ''}
        </div>
        ${(v.example_vi || v.example_en) ? `
          <div class="vocab-ex">
            ${v.example_vi ? `<div class="vocab-ex-vi">VI: ${escapeHtml(v.example_vi)}</div>` : ''}
            ${v.example_en ? `<div class="vocab-ex-en">EN: ${escapeHtml(v.example_en)}</div>` : ''}
          </div>` : ''}
      </div>
      <div class="vocab-acts">
        <button type="button" class="btn btn-sm" data-vocab-speak="${v.id}" title="Listen English">🔊</button>
        <button type="button" class="btn btn-sm btn-danger" data-vocab-del="${v.id}" title="Delete">${state.appLang === 'en' ? 'Delete' : 'Xóa'}</button>
      </div>
    </div>`).join('');

  listEl.querySelectorAll('[data-vocab-speak]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const v = items.find((x) => String(x.id) === btn.getAttribute('data-vocab-speak'));
      if (v) speakEnglishText(v.en_term);
    });
  });
  listEl.querySelectorAll('[data-vocab-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      deleteEnVocabItem(Number(btn.getAttribute('data-vocab-del')));
    });
  });
}

async function submitQuickVocabAdd(ev) {
  if (ev) ev.preventDefault();
  const vi = (document.getElementById('vocab-add-vi')?.value || '').trim();
  const en = (document.getElementById('vocab-add-en')?.value || '').trim();
  const cat = document.getElementById('vocab-add-cat')?.value || 'PLC';
  const exVi = (document.getElementById('vocab-add-ex-vi')?.value || '').trim();
  const exEn = (document.getElementById('vocab-add-ex-en')?.value || '').trim();
  if (!vi || !en) {
    showToast(state.appLang === 'en' ? 'Please enter both Vietnamese and English terms' : 'Vui lòng nhập cả thuật ngữ Tiếng Việt và Tiếng Anh', 'error');
    return;
  }
  const saved = await saveToEnVocabulary({ vi, en, category: cat, example_vi: exVi, example_en: exEn, source_ref: 'MANUAL' });
  if (saved) {
    ['vocab-add-vi', 'vocab-add-en', 'vocab-add-ex-vi', 'vocab-add-ex-en'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }
}

function startEnVocabFlashcards(mode = 'en_vocab') {
  closeVocabModal();
  const ws = state.activeWorkspace || 'plc';
  state.flashcard.focusItem = null;
  state.flashcard.mode = mode;
  enterWorkspace(ws, 'flashcards');
  const modeSel = document.getElementById('fc-mode-filter');
  if (modeSel) modeSel.value = mode;
  buildFlashcardDeck(false);
}

function buildEnVocabFlashcards(mode = 'en_vocab', ws = 'plc', catFilter = 'ALL', statusFilter = 'ALL') {
  const srcList = (state.englishVocab && state.englishVocab.length) ? state.englishVocab : (state.enVocabulary || []);
  let vocab = srcList.slice();
  if (catFilter && catFilter !== 'ALL') {
    vocab = vocab.filter((v) => String(v.category || '') === catFilter || String(v.legacy_category || '') === catFilter);
  }
  if (statusFilter && statusFilter !== 'ALL' && ws === 'english') {
    if (statusFilter === 'ACTIVE') {
      vocab = vocab.filter((v) => (v.status_code || 'review') === 'review' || v.status_code === 'researching');
    } else {
      vocab = vocab.filter((v) => (v.status_code || 'review') === statusFilter);
    }
  }
  const gloss = (state.enGlossary || []).map((g, idx) => ({
    id: `g-${idx}`,
    vi_term: g.vi,
    meaning_vi: g.vi,
    en_term: g.en,
    term_or_chunk: g.en,
    pronunciation: '',
    category: g.category || 'TECH',
    example_vi: '',
    example_en: g.note || '',
    source_ref: g.category || 'GLOSSARY',
  }));
  const primaryList = (vocab.length || ws === 'english') ? vocab : gloss;
  const preferredCat = ws === 'plc' ? 'PLC' : (ws === 'network' ? 'NET' : (ws === 'english' ? '' : 'REPAIR'));
  if (preferredCat) {
    primaryList.sort((a, b) => {
      const ap = String(a.legacy_category || a.category || '').toUpperCase() === preferredCat ? 0 : 1;
      const bp = String(b.legacy_category || b.category || '').toUpperCase() === preferredCat ? 0 : 1;
      return ap - bp;
    });
  }

  const isEnUi = state.appLang === 'en';

  if (mode === 'en_quiz') {
    const poolMap = new Map();
    [...srcList, ...gloss].forEach((x) => {
      const enVal = x.term_or_chunk || x.en_term;
      if (enVal && !poolMap.has(enVal.toLowerCase())) poolMap.set(enVal.toLowerCase(), enVal);
    });
    const allEnOptions = Array.from(poolMap.values());
    const cards = [];
    primaryList.forEach((v, idx) => {
      const enVal = v.term_or_chunk || v.en_term;
      const viVal = v.meaning_vi || v.vi_term;
      const distractors = _shuffledCopy(allEnOptions.filter((en) => en.toLowerCase() !== String(enVal).toLowerCase())).slice(0, 3);
      if (distractors.length < 3) return;
      const opts = _shuffledCopy([{ text: enVal, ok: true }, ...distractors.map((d) => ({ text: d, ok: false }))]);
      cards.push({
        cardKey: `enquiz:${v.id || idx}:${_hashKey(viVal)}`,
        kind: 'en_vocab',
        id: v.source_ref || 'EN-VOCAB',
        item: v,
        ws,
        title: `🇬🇧 ${viVal}`,
        badge: isEnUi ? 'TECHNICAL ENGLISH' : 'TIẾNG ANH CHUYÊN NGÀNH',
        subBadge: categoryLabel(v.category || 'TECH'),
        enAudioText: enVal,
        question: isEnUi
          ? `Select the matching Technical English term / Lexical Chunk for "${viVal}":${v.example_vi ? `\n\nContext: "${v.example_vi}"` : ''}`
          : `Thuật ngữ / Lexical Chunk Tiếng Anh chuẩn của "${viVal}" là gì?${v.example_vi ? `\n\nVí dụ: "${v.example_vi}"` : ''}`,
        answerText: `${enVal}`,
        answerHtml: `
          <div class="note-block ans">
            <div class="nb-title" data-no-i18n="1">${escapeHtml(enVal)}${v.pronunciation ? ` <span class="vb-ipa" style="margin-left:8px;">${escapeHtml(v.pronunciation)}</span>` : ''}</div>
            <div class="nb-body">
              ${v.example_en ? `<div><b>EN:</b> ${escapeHtml(v.example_en)}</div>` : ''}
              ${v.example_vi ? `<div style="margin-top:4px;color:var(--text-3);"><b>VI:</b> ${escapeHtml(v.example_vi)}</div>` : ''}
            </div>
          </div>`,
        quiz: { options: opts.map((o) => o.text), correctIdx: opts.findIndex((o) => o.ok) },
      });
    });
    return cards;
  }

  return primaryList.map((v, idx) => {
    const enVal = v.term_or_chunk || v.en_term;
    const viVal = v.meaning_vi || v.vi_term;
    return {
      cardKey: `envocab:${v.id || idx}:${_hashKey(viVal)}`,
      kind: 'en_vocab',
      id: v.source_ref || 'EN-VOCAB',
      item: v,
      ws,
      title: viVal,
      badge: isEnUi ? 'TECHNICAL VOCAB VI ⇄ EN' : 'TỪ VỰNG KỸ THUẬT VI ⇄ EN',
      subBadge: categoryLabel(v.category || 'TECH'),
      enAudioText: enVal,
      question: isEnUi
        ? `Recall the Technical English term / Lexical Chunk for:\n"${viVal}"${v.example_vi ? `\n\nContext: "${v.example_vi}"` : ''}`
        : `Hãy nhớ lại thuật ngữ / cụm từ Tiếng Anh chuyên ngành của:\n"${viVal}"${v.example_vi ? `\n\nNgữ cảnh: "${v.example_vi}"` : ''}`,
      hint: enVal ? `Hint: "${enVal.slice(0, Math.min(4, enVal.length))}..." (${enVal.split(/\s+/).length} words)` : '',
      answerText: enVal,
      answerHtml: `
        <div class="note-block ans">
          <div class="nb-title" data-no-i18n="1"><span>🇬🇧 ${escapeHtml(enVal)}${v.pronunciation ? ` <span class="vb-ipa" style="margin-left:8px;">${escapeHtml(v.pronunciation)}</span>` : ''}</span></div>
          <div class="nb-body">
            ${v.example_en ? `<div><b>EN:</b> ${escapeHtml(v.example_en)}</div>` : ''}
            ${v.example_vi ? `<div style="margin-top:4px;color:var(--text-3);"><b>VI:</b> ${escapeHtml(v.example_vi)}</div>` : ''}
          </div>
        </div>`,
      quiz: null,
    };
  });
}

// ---- Global Listeners: Bidirectional Selection Translate + Hover Term Tooltip ----
document.addEventListener('mouseup', (e) => {
  if (e.button !== 0 || (!state.enMode && state.appLang !== 'en')) return;
  const target = e.target;
  if (!target?.closest) return;
  if (target.closest('#en-selection-popover, #en-hover-tip, #ctx-menu, .overlay:not(.hidden)')) return;

  const clientX = e.clientX;
  const clientY = e.clientY;

  // Hỗ trợ bôi đen trực tiếp từ mới bên trong Vở Nháp Đọc Manual (#scratchpad-textarea)
  if (target.id === 'scratchpad-textarea' || target.id === 'pane2-scratchpad-textarea') {
    setTimeout(() => {
      if (!state.enMode && state.appLang !== 'en') return;
      const start = target.selectionStart || 0;
      const end = target.selectionEnd || 0;
      if (end <= start) return;
      const clean = String(target.value.slice(start, end) || '').replace(/\s+/g, ' ').trim();
      if (clean.length < 2 || clean.length > 1200 || !/[\p{L}\p{N}]/u.test(clean)) return;
      const anchorRect = { left: clientX, right: clientX + 10, top: clientY, bottom: clientY + 18 };
      openSelectionTranslatorForText(clean, anchorRect, 'MANUAL-SCRATCHPAD', 'auto');
    }, 25);
    return;
  }

  if (target.closest('input, textarea, select, button')) return;
  if (!target.closest('.detail-pane, .fc-card, .portal-body, .scratchpad-wrap, #view-en-quiz, #view-en-coach, #view-en-reading, #view-en-ingest')) return;

  setTimeout(() => {
    if (!state.enMode && state.appLang !== 'en') return;
    const sel = window.getSelection ? window.getSelection() : null;
    if (!sel || sel.isCollapsed) return;
    const clean = String(sel.toString() || '').replace(/\s+/g, ' ').trim();
    if (clean.length < 2 || clean.length > 1500 || !/[\p{L}\p{N}]/u.test(clean)) return;
    const range = sel.rangeCount ? sel.getRangeAt(0) : null;
    const anc = range?.commonAncestorContainer;
    const ancEl = anc && (anc.nodeType === 1 ? anc : anc.parentElement);
    if (!ancEl || !ancEl.closest?.('.detail-pane, .fc-card, .portal-body, .scratchpad-wrap, #view-en-quiz, #view-en-coach, #view-en-reading, #view-en-ingest')) return;
    const r = range.getBoundingClientRect();
    const anchorRect = (r && (r.width > 0 || r.height > 0)) ? r : { left: clientX, right: clientX + 10, top: clientY, bottom: clientY + 18 };
    openSelectionTranslatorForText(clean, anchorRect, _activeRecordContextId(), 'auto');
  }, 20);
});

document.addEventListener('mouseover', (e) => {
  if (!state.enMode && state.appLang !== 'en') return;
  const hl = e.target?.closest?.('.en-term-hl');
  if (hl) {
    _showHoverTipForSpan(hl);
    return;
  }
  if (e.target?.closest?.('#en-hover-tip')) {
    clearTimeout(_enHoverHideTimer);
  }
});

document.addEventListener('mouseout', (e) => {
  const fromHl = e.target?.closest?.('.en-term-hl');
  const fromTip = e.target?.closest?.('#en-hover-tip');
  if (!fromHl && !fromTip) return;
  const toEl = e.relatedTarget;
  if (toEl?.closest?.('#en-hover-tip') || toEl?.closest?.('.en-term-hl')) return;
  clearTimeout(_enHoverHideTimer);
  _enHoverHideTimer = setTimeout(() => {
    document.getElementById('en-hover-tip')?.classList.add('hidden');
  }, 260);
});

document.addEventListener('click', (e) => {
  if (!state.enMode && state.appLang !== 'en') return;
  const hl = e.target?.closest?.('.en-term-hl');
  if (hl) {
    e.stopPropagation();
    _showHoverTipForSpan(hl);
  }
});

let _enMobileSelTimer = null;
function _ensureMobileSelectionBtn() {
  let btn = document.getElementById('en-mobile-sel-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'en-mobile-sel-btn';
    btn.className = 'en-mobile-sel-btn hidden';
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const payload = btn._selPayload;
      btn.classList.add('hidden');
      if (payload) {
        openSelectionTranslatorForText(payload.clean, payload.anchorRect, payload.sourceRef, 'auto');
      }
    });
    document.body.appendChild(btn);
  }
  return btn;
}

function _getTouchSelectionPayload() {
  const scopeSel = '.detail-pane, .fc-card, .portal-body, .scratchpad-wrap, #view-en-quiz, #view-en-coach, #view-en-reading, #view-en-ingest';
  const active = document.activeElement;
  if (active && (active.id === 'scratchpad-textarea' || active.id === 'pane2-scratchpad-textarea')) {
    const st = active.selectionStart || 0;
    const en = active.selectionEnd || 0;
    if (en > st) {
      const clean = String(active.value.slice(st, en) || '').replace(/\s+/g, ' ').trim();
      if (clean.length >= 2 && clean.length <= 1200 && /[\p{L}\p{N}]/u.test(clean)) {
        const r = active.getBoundingClientRect();
        return {
          clean,
          sourceRef: 'MANUAL-SCRATCHPAD',
          anchorRect: { left: r.left + 16, right: r.right - 16, top: Math.max(60, r.top + 40), bottom: Math.max(80, r.top + 60) },
        };
      }
    }
  }
  const sel = window.getSelection ? window.getSelection() : null;
  if (!sel || sel.isCollapsed) return null;
  const clean = String(sel.toString() || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 2 || clean.length > 1500 || !/[\p{L}\p{N}]/u.test(clean)) return null;
  const range = sel.rangeCount ? sel.getRangeAt(0) : null;
  const anc = range?.commonAncestorContainer;
  const ancEl = anc && (anc.nodeType === 1 ? anc : anc.parentElement);
  if (!ancEl || !ancEl.closest?.(scopeSel)) return null;
  const r = range.getBoundingClientRect();
  const anchorRect = (r && (r.width > 0 || r.height > 0)) ? r : { left: 16, right: 320, top: 140, bottom: 160 };
  return { clean, sourceRef: _activeRecordContextId(), anchorRect };
}

document.addEventListener('selectionchange', () => {
  const isTouchLike = window.matchMedia?.('(max-width: 767px)').matches || ('ontouchstart' in window && window.innerWidth <= 900);
  if (!isTouchLike) return;
  clearTimeout(_enMobileSelTimer);
  _enMobileSelTimer = setTimeout(() => {
    const btn = document.getElementById('en-mobile-sel-btn');
    if (!state.enMode && state.appLang !== 'en') {
      if (btn) btn.classList.add('hidden');
      return;
    }
    const payload = _getTouchSelectionPayload();
    if (!payload) {
      if (btn) btn.classList.add('hidden');
      return;
    }
    const el = _ensureMobileSelectionBtn();
    el._selPayload = payload;
    el.textContent = state.appLang === 'en' ? '🇬🇧 Translate selection' : '🇬🇧 Dịch đoạn đang chọn';
    el.classList.remove('hidden');
  }, 350);
});

document.addEventListener('mousedown', (e) => {
  const pop = document.getElementById('en-selection-popover');
  if (pop && !pop.classList.contains('hidden') && !e.target?.closest?.('#en-selection-popover, #ctx-menu, #en-mobile-sel-btn')) {
    pop.classList.add('hidden');
  }
  const tip = document.getElementById('en-hover-tip');
  if (tip && !tip.classList.contains('hidden') && !e.target?.closest?.('#en-hover-tip, .en-term-hl')) {
    tip.classList.add('hidden');
  }
});

document.addEventListener('touchstart', (e) => {
  const pop = document.getElementById('en-selection-popover');
  if (pop && !pop.classList.contains('hidden') && !e.target?.closest?.('#en-selection-popover, #ctx-menu, #en-mobile-sel-btn')) {
    pop.classList.add('hidden');
  }
  const tip = document.getElementById('en-hover-tip');
  if (tip && !tip.classList.contains('hidden') && !e.target?.closest?.('#en-hover-tip, .en-term-hl')) {
    tip.classList.add('hidden');
  }
}, { passive: true });

if (typeof MutationObserver !== 'undefined') {
  new MutationObserver((muts) => {
    if (state.appLang !== 'en') return;
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName === 'class' && m.target?.classList?.contains('overlay') && !m.target.classList.contains('hidden')) {
        requestAnimationFrame(() => {
          _translateUiLeafNodes(m.target, true);
          translateVisibleRecordContentToEn();
        });
      }
    }
  }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
}
