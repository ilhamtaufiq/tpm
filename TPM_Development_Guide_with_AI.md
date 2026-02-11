# PANDUAN DEVELOPMENT APLIKASI TPM DENGAN AI
## Menggunakan Claude Opus & Gemini AI

---

## 1. STRATEGI PEMBAGIAN TUGAS AI

### 1.1 Claude Opus (Primary - Complex Logic)
**Kelebihan:**
- Reasoning kemampuan tinggi
- Pemahaman konteks yang dalam
- Code quality tinggi
- Dokumentasi detail

**Tugas Optimal:**
- Arsitektur sistem & database design
- Business logic kompleks (perhitungan laba rugi, modal)
- API endpoint design
- Complex queries & optimization
- Security implementation
- Error handling & validation
- Testing strategy

### 1.2 Gemini AI (Secondary - Implementation)
**Kelebihan:**
- Fast code generation
- Good untuk boilerplate code
- Multi-modal (bisa lihat gambar/diagram)
- Gratis dengan quota tinggi

**Tugas Optimal:**
- Generate CRUD operations
- UI components React Native
- Repetitive code (forms, lists)
- API integration code
- Simple utilities & helpers
- CSS/Styling
- Documentation translation

---

## 2. WORKFLOW DEVELOPMENT YANG EFISIEN

### Phase 1: PLANNING & ARCHITECTURE (Claude Opus)
```
Step 1: Review dokumentasi lengkap
Prompt: "Review dokumen TPM_App_Documentation.md, fokus pada [modul tertentu]. 
Buatkan detail technical specification untuk implementasi [feature]"

Step 2: Database schema refinement
Prompt: "Generate SQL migration scripts untuk [modul] dengan:
- Foreign key constraints
- Indexes untuk query optimization
- Triggers jika diperlukan"

Step 3: API contract design
Prompt: "Buatkan API contract (request/response schemas) lengkap untuk modul [X]
dengan validasi, error handling, dan contoh payload"
```

### Phase 2: BACKEND IMPLEMENTATION

#### 2.1 Core Setup (Claude Opus)
```python
# Prompt untuk Opus:
"""
Buatkan FastAPI project structure lengkap untuk TPM dengan:
1. Config management (database, JWT, CORS)
2. Database connection pooling
3. Base models & schemas
4. Authentication middleware
5. Error handler middleware
6. Logger setup
"""
```

#### 2.2 CRUD Operations (Gemini)
```python
# Prompt untuk Gemini:
"""
Generate CRUD operations untuk tabel 'suppliers' dengan:
- SQLAlchemy models
- Pydantic schemas (Create, Update, Response)
- Service layer dengan error handling
- API routes dengan dependencies

Referensi schema:
[paste supplier table schema]
"""
```

#### 2.3 Complex Business Logic (Claude Opus)
```python
# Prompt untuk Opus:
"""
Implementasi perhitungan Laporan Laba Rugi TPM dengan:

Input: periode (bulan, tahun)
Process:
1. Hitung laba bengkel (penjualan - HPP - biaya operasional - gaji)
2. Hitung laba jasa angkut (50% dari muatan - biaya)
3. Hitung laba jual beli mobil (split investor/TPM)
4. Agregasi total
5. Kurangi pengeluaran & prive

Output: Detailed profit/loss statement

Dengan error handling, transaction management, dan optimization.
"""
```

### Phase 3: FRONTEND IMPLEMENTATION

#### 3.1 Navigation & Routing (Gemini)
```javascript
// Prompt untuk Gemini:
"""
Generate React Navigation setup untuk TPM app:
- Auth stack (Login, Register)
- Main bottom tabs (Dashboard, Bengkel, Mobil, Jasa Angkut, Laporan)
- Nested stack navigators per tab
- Protected routes dengan auth check

Gunakan @react-navigation/native v6
"""
```

#### 3.2 Reusable Components (Gemini)
```javascript
// Prompt untuk Gemini:
"""
Create reusable React Native components:
1. CustomButton (dengan loading state)
2. CustomInput (dengan validation)
3. SearchBar
4. DataCard
5. EmptyState
6. LoadingOverlay

Dengan TypeScript types dan responsive design
"""
```

#### 3.3 Complex Screens (Claude Opus)
```javascript
// Prompt untuk Opus:
"""
Buatkan TransaksiPenjualanBengkelScreen lengkap dengan:

Features:
- Multi-item selection (spare parts)
- Service items dynamic add/remove
- Auto calculate HPP, subtotal, diskon, total
- Stock validation real-time
- Customer search dengan autocomplete
- Payment method selection
- Print invoice integration

Dengan Redux state management, form validation (Formik + Yup),
error handling, dan optimistic updates.
"""
```

#### 3.4 Forms (Mix: Design by Opus, Implementation by Gemini)

**Claude Opus - Design Form Logic:**
```
Prompt: "Design form structure dan validation logic untuk TransaksiPenjualanBengkel:
- Fields yang diperlukan
- Validation rules
- Conditional fields
- Calculation dependencies
- Error messages Indonesia"
```

**Gemini - Implement Form:**
```
Prompt: "Implementasikan form ini dengan Formik + Yup berdasarkan design:
[paste design dari Opus]

Gunakan custom components yang sudah ada.
"
```

### Phase 4: INTEGRATION & OPTIMIZATION

#### 4.1 API Integration (Gemini)
```javascript
// Prompt untuk Gemini:
"""
Generate API service layer untuk modul Bengkel:
- axiosConfig dengan interceptors (auth token, error handling)
- CRUD functions (create, read, update, delete)
- Search & filter functions
- Pagination support

Base URL: http://api.tpm.local/api/v1
"""
```

#### 4.2 State Management (Claude Opus)
```javascript
// Prompt untuk Opus:
"""
Design Redux Toolkit slices untuk TPM app dengan:

Slices needed:
- auth (user, token, permissions)
- bengkel (transactions, spare parts, stock)
- mobil (inventory, sales)
- jasaAngkut (drivers, loads)
- karyawan (employees, attendance)

Dengan:
- Async thunks untuk API calls
- Optimistic updates
- Error handling
- Cache strategy
- Persistence (redux-persist)
"""
```

#### 4.3 Performance Optimization (Claude Opus)
```
Prompt: "Review kode [paste component/service] dan berikan optimization:
1. Database query optimization (indexes, joins)
2. React Native performance (memoization, lazy loading)
3. API response caching
4. Image optimization
5. Bundle size reduction"
```

---

## 3. PROMPT TEMPLATES EFEKTIF

### 3.1 Untuk Claude Opus

#### Template 1: Complex Feature
```
Role: Senior Full-stack Developer

Task: Implementasi fitur [FEATURE_NAME] untuk aplikasi TPM

Context:
- Tech stack: React Native, FastAPI, MySQL
- Referensi dokumentasi: [paste relevant doc section]
- Related files: [list files]

Requirements:
1. [Requirement 1]
2. [Requirement 2]
3. [Requirement 3]

Deliverables:
- Backend: API endpoints dengan validation
- Frontend: Complete screen dengan state management
- Database: Migrations jika perlu
- Tests: Unit test untuk business logic
- Documentation: API docs & inline comments

Code quality expectations:
- Clean code principles
- Error handling
- Type safety (TypeScript untuk frontend)
- Security best practices
```

#### Template 2: Code Review
```
Review kode ini dan berikan feedback:

[paste code]

Fokus pada:
1. Security vulnerabilities
2. Performance issues
3. Code maintainability
4. Best practices violations
5. Potential bugs

Berikan:
- Issue description
- Severity (Critical/High/Medium/Low)
- Suggested fix dengan code example
```

#### Template 3: Architecture Decision
```
Saya perlu membuat keputusan arsitektur untuk [TOPIC]:

Option 1: [Approach 1]
Pro: ...
Con: ...

Option 2: [Approach 2]
Pro: ...
Con: ...

Context aplikasi TPM:
- [Relevant context]

Berikan analisis mendalam:
1. Rekomendasi dengan reasoning
2. Trade-offs yang harus dipertimbangkan
3. Implementation strategy
4. Potential future issues
```

### 3.2 Untuk Gemini AI

#### Template 1: Component Generation
```
Generate React Native component: [COMPONENT_NAME]

Props:
- [prop1]: type - description
- [prop2]: type - description

Features:
- [Feature 1]
- [Feature 2]

Styling:
- Use StyleSheet
- Responsive design
- Match color scheme: [colors]

Example usage:
[paste example]
```

#### Template 2: CRUD Boilerplate
```
Generate complete CRUD for entity: [ENTITY_NAME]

Database schema:
```sql
[paste schema]
```

Generate:
1. SQLAlchemy model
2. Pydantic schemas (Create, Update, Response)
3. Service functions (create, read, update, delete, list)
4. FastAPI routes dengan documentation
5. Basic error handling

Follow FastAPI best practices.
```

#### Template 3: UI Form
```
Create form for: [FORM_PURPOSE]

Fields:
- [field1]: type, validation
- [field2]: type, validation

Libraries:
- Formik for form state
- Yup for validation
- FontAwesome icons

Requirements:
- Error messages in Indonesian
- Loading state
- Success/error feedback
- Responsive layout
```

---

## 4. WORKFLOW PRAKTIS PER MODUL

### Contoh: Implementasi Modul Bengkel

#### Step 1: Database (Claude Opus)
```
Prompt: "Generate SQL migration untuk modul Bengkel dengan tabel:
- spare_parts
- pembelian_spare_parts
- transaksi_penjualan_bengkel
- detail_transaksi_spare_parts
- detail_transaksi_services
- pengeluaran_bengkel

Dengan foreign keys, indexes, dan triggers untuk:
- Auto update stock saat transaksi
- Calculate HPP otomatis
"

Hasil: 001_create_bengkel_tables.sql
```

#### Step 2: Backend Models & Schemas (Gemini)
```
Prompt: "Generate SQLAlchemy models dan Pydantic schemas untuk:
[paste hasil SQL dari step 1]

Dengan relationships dan validators."

Hasil: 
- models/bengkel.py
- schemas/bengkel.py
```

#### Step 3: Business Logic (Claude Opus)
```
Prompt: "Implementasi service layer untuk transaksi penjualan bengkel:

Features:
- Multi-item transaction
- Stock deduction dengan rollback jika gagal
- HPP calculation
- Piutang management
- Invoice generation

Dengan transaction management, error handling, dan logging."

Hasil: services/bengkel_service.py
```

#### Step 4: API Routes (Gemini)
```
Prompt: "Generate FastAPI routes untuk bengkel_service.py:

Endpoints:
- POST /transaksi (create)
- GET /transaksi (list dengan pagination)
- GET /transaksi/{id} (detail)
- PUT /transaksi/{id} (update)
- DELETE /transaksi/{id}
- POST /transaksi/{id}/payment (pelunasan)
- GET /transaksi/{id}/invoice (generate invoice)

Dengan auth dependency dan request/response schemas."

Hasil: api/v1/bengkel.py
```

#### Step 5: Frontend Components (Gemini)
```
Prompt: "Generate reusable components untuk modul bengkel:
- SparePartSelector (with search)
- ServiceItemInput
- CustomerSelector (autocomplete)
- PaymentMethodPicker
- TransactionSummary

Dengan PropTypes dan basic styling."

Hasil: components/bengkel/
```

#### Step 6: Main Screen (Claude Opus)
```
Prompt: "Implementasi TransaksiPenjualanBengkelScreen lengkap:

Features: [detail features]

Integrasikan components dari step 5.
Redux state management untuk cart items.
Form validation dengan Formik.
API integration dengan error handling.
Success/error notifications.
Navigation ke invoice screen setelah success."

Hasil: screens/bengkel/TransaksiPenjualanScreen.js
```

#### Step 7: Redux Integration (Claude Opus)
```
Prompt: "Generate Redux slice untuk bengkel:
- State: transactions, spareparts, selectedItems, loading, error
- Actions: CRUD operations
- Async thunks dengan API calls
- Selectors untuk computed values
- Cache strategy"

Hasil: store/slices/bengkelSlice.js
```

#### Step 8: Testing (Claude Opus)
```
Prompt: "Generate tests untuk bengkel module:

Backend:
- Unit test untuk service functions
- Integration test untuk API endpoints
- Test edge cases dan error scenarios

Frontend:
- Component tests dengan React Native Testing Library
- Redux slice tests
- Navigation tests

Dengan test fixtures dan mocks."

Hasil: tests/bengkel/
```

---

## 5. TIPS & BEST PRACTICES

### 5.1 Untuk Claude Opus

✅ **DO:**
- Berikan context lengkap dan dokumentasi
- Minta reasoning di balik decisions
- Gunakan untuk design patterns
- Review code quality dan security
- Kompleks business logic
- Architecture decisions

❌ **DON'T:**
- Generate boilerplate repetitif (gunakan Gemini)
- Simple copy-paste tasks
- Pure UI styling tanpa logic

### 5.2 Untuk Gemini AI

✅ **DO:**
- Quick component generation
- CRUD boilerplate
- Simple utilities
- Form implementations
- API integration code
- Styling & layout

❌ **DON'T:**
- Complex business logic tanpa review
- Security-critical code
- Architecture decisions
- Performance-critical optimizations

### 5.3 Workflow Collaboration

```
Opus (Design) → Gemini (Implement) → Opus (Review) → Production

Contoh:
1. Opus: Design form validation logic
2. Gemini: Implement form dengan Formik
3. Opus: Review security & edge cases
4. Commit to repo
```

---

## 6. PROMPT LIBRARIES

### 6.1 Backend Development

#### Create API Endpoint
```
[For Claude Opus]

Create RESTful API endpoint untuk [RESOURCE]:

Method: [GET/POST/PUT/DELETE]
Path: /api/v1/[resource]

Request:
- Headers: [list headers]
- Body: [schema]
- Query params: [list params]

Response:
- Success: [status code, schema]
- Errors: [possible errors dengan status codes]

Business rules:
1. [Rule 1]
2. [Rule 2]

Include:
- Input validation
- Authorization check
- Error handling
- Logging
- API documentation (docstring)
```

#### Database Optimization
```
[For Claude Opus]

Optimize database query untuk [USE_CASE]:

Current query:
```sql
[paste current query]
```

Issues:
- [Performance issue]
- [Bottleneck]

Expected:
- Query time: [target]
- Scalability: [requirements]

Provide:
1. Optimized query
2. Necessary indexes
3. Explain plan analysis
4. Alternative approaches
```

### 6.2 Frontend Development

#### Create Screen
```
[For Gemini - Initial Implementation]

Create React Native screen: [SCREEN_NAME]

Features:
- [Feature 1]
- [Feature 2]

Components needed:
- [Component 1]
- [Component 2]

Navigation:
- Receives params: [params]
- Navigate to: [screens]

State management: Redux
API calls: [endpoints]

Layout: [describe layout]
```

```
[For Claude Opus - Add Complex Logic]

Enhance [SCREEN_NAME] dengan:

Complex features:
1. [Complex feature 1 dengan detail]
2. [Complex feature 2 dengan detail]

State management:
- Redux actions: [list]
- Local state: [list]
- Side effects: [list]

Error scenarios:
- [Scenario 1 dan handling]
- [Scenario 2 dan handling]

Performance:
- Optimization strategies
- Memoization
- Lazy loading
```

#### Form with Validation
```
[For Gemini]

Create form: [FORM_NAME]

Fields:
| Field | Type | Validation | Default |
|-------|------|------------|---------|
| [field1] | text | required, min 3 | - |
| [field2] | number | required, min 0 | 0 |

Libraries:
- Formik (form state)
- Yup (validation)

Features:
- Submit button dengan loading state
- Error messages in Indonesian
- Reset form after success
- Responsive layout

API endpoint: POST /api/v1/[endpoint]
```

### 6.3 Integration & Testing

#### API Integration
```
[For Gemini]

Create API service: [SERVICE_NAME]

Base URL: [base_url]

Methods:
- [method1]: [HTTP_METHOD] [endpoint] - description
- [method2]: [HTTP_METHOD] [endpoint] - description

Features:
- Axios interceptors (auth token)
- Error handling dengan user-friendly messages
- Request/response logging
- Timeout configuration
- Retry logic untuk network errors

TypeScript types untuk request/response.
```

#### Unit Testing
```
[For Claude Opus]

Create comprehensive tests untuk [COMPONENT/SERVICE]:

Test cases:
1. Happy path scenarios
2. Error scenarios
3. Edge cases
4. Boundary conditions

Mock:
- [Dependency 1]
- [Dependency 2]

Coverage target: 80%+

Include:
- Setup & teardown
- Test fixtures
- Assertion messages
- Test documentation
```

---

## 7. CHECKLIST DEVELOPMENT

### Per Feature Checklist

#### Backend
- [ ] Database migration created
- [ ] Models dengan relationships
- [ ] Pydantic schemas (CRUD)
- [ ] Service layer dengan business logic
- [ ] API routes dengan auth
- [ ] Input validation
- [ ] Error handling
- [ ] Logging
- [ ] Unit tests
- [ ] Integration tests
- [ ] API documentation

#### Frontend
- [ ] Navigation setup
- [ ] Reusable components
- [ ] Main screen
- [ ] Form validation
- [ ] Redux slice (if needed)
- [ ] API integration
- [ ] Error handling
- [ ] Loading states
- [ ] Empty states
- [ ] Success feedback
- [ ] Component tests
- [ ] Navigation tests

#### Integration
- [ ] End-to-end test
- [ ] Performance test
- [ ] Security review
- [ ] Code review
- [ ] Documentation updated

---

## 8. SAMPLE CONVERSATION FLOW

### Scenario: Membuat Fitur Transaksi Penjualan Bengkel

#### Conversation 1: dengan Claude Opus
```
You: "Saya akan membuat fitur transaksi penjualan bengkel. 
Review dokumen TPM_App_Documentation.md section 3.2.2 dan buatkan:
1. Detailed technical specification
2. Database schema refinement
3. API contract
4. Business logic flow diagram
5. Edge cases yang harus dihandle"

Opus: [Memberikan analisis mendalam + recommendations]

You: "Ok, buatkan SQL migration dan service layer lengkap 
dengan transaction management."

Opus: [Generate code berkualitas tinggi]

You: "Generate unit tests untuk service layer ini."

Opus: [Generate comprehensive tests]
```

#### Conversation 2: dengan Gemini
```
You: "Generate SQLAlchemy models untuk schema ini:
[paste schema dari Opus]"

Gemini: [Generate models]

You: "Generate Pydantic schemas (Create, Update, Response)."

Gemini: [Generate schemas]

You: "Generate FastAPI routes untuk CRUD operations."

Gemini: [Generate routes]

You: "Generate React Native components:
- SparePartSelector
- ServiceItemInput
- PaymentMethodPicker"

Gemini: [Generate components]
```

#### Conversation 3: kembali ke Claude Opus
```
You: "Review kode yang di-generate Gemini:
[paste code]

Fokus pada:
- Security issues
- Business logic correctness
- Error handling
- Performance"

Opus: [Detailed review + improvements]

You: "Implement improvements dan buat main screen lengkap 
dengan state management."

Opus: [Generate improved version]
```

---

## 9. RESOURCE MANAGEMENT

### Token Efficiency

**Claude Opus (Lebih mahal):**
- Gunakan untuk critical decisions
- Complex logic implementation
- Code review & optimization
- Max 3-4 major features per session

**Gemini (Gratis/Murah):**
- Gunakan untuk boilerplate
- Simple implementations
- Bisa generate banyak components
- Unlimited repetitive tasks

### File Organization

```
Simpan hasil generation:
/tpm-prompts/
├── opus-outputs/
│   ├── 01-database-design/
│   ├── 02-business-logic/
│   ├── 03-api-contracts/
│   └── 04-reviews/
├── gemini-outputs/
│   ├── 01-models-schemas/
│   ├── 02-routes/
│   ├── 03-components/
│   └── 04-forms/
└── final-code/
    ├── backend/
    └── frontend/
```

---

## 10. TROUBLESHOOTING COMMON ISSUES

### Issue 1: Code dari AI tidak sync
**Solution:**
```
1. Maintain single source of truth (documentation)
2. Setiap major change, update documentation
3. Share context file saat switch AI
4. Code review sebelum merge
```

### Issue 2: AI menghasilkan code outdated
**Solution:**
```
Prefix prompt dengan:
"Menggunakan:
- React Native 0.72.6
- FastAPI 0.104.1
- MySQL 8.0
[List versions]"
```

### Issue 3: Terlalu banyak variants
**Solution:**
```
1. Establish coding standards di awal
2. Create style guide
3. Gunakan linter & formatter
4. Review patterns consistency
```

---

## 11. ESTIMATED TIMELINE dengan AI

### Traditional Development: 12 minggu
### With AI Assistance: 6-8 minggu

**Breakdown:**
- Week 1: Setup + Database (Opus) - 3 hari
- Week 2-3: Backend APIs (Mix) - 10 hari
- Week 3-4: Frontend Components (Gemini) - 10 hari
- Week 5: Integration (Opus review) - 5 hari
- Week 6: Testing + Bug fixes (Mix) - 5 hari
- Week 7-8: Polish + Documentation - 10 hari

**Time Saved:** ~40-50% dengan AI assistance

---

## 12. COST ESTIMATION

### Claude Opus (via API atau Pro)
- Pro subscription: $20/bulan (unlimited)
- API: ~$15/1M input tokens, ~$75/1M output tokens
- Estimated: $20-50 untuk project ini

### Gemini
- Free tier: Sangat generous
- Pro: $20/bulan (jika perlu lebih)
- Estimated: $0-20 untuk project ini

**Total AI Cost: $20-70** untuk project senilai ~$10,000-15,000

**ROI: 200-300x** 🚀

---

## KESIMPULAN

Strategi optimal:
1. **Planning & Architecture** → Claude Opus
2. **Boilerplate & Implementation** → Gemini
3. **Complex Logic** → Claude Opus
4. **Review & Optimization** → Claude Opus
5. **Testing & Documentation** → Mix

Dengan workflow ini, Anda bisa:
- ✅ Build 2x lebih cepat
- ✅ Code quality tinggi
- ✅ Best practices implemented
- ✅ Comprehensive testing
- ✅ Complete documentation
- ✅ Cost-effective

**Happy Coding!** 🎉
