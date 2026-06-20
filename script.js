/**
 * CYBERNET COMPUTER INSTITUTE
 * Main JavaScript File
 * Handles Supabase integration, registration, and certificate verification.
 */

// 1. Supabase Configuration
// Replace these with your actual Supabase project URL and Anon Key
const SUPABASE_URL = 'https://kpbcrndtbtpsmqkcsrqf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYmNybmR0YnRwc21xa2NzcnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDg0MDEsImV4cCI6MjA5NDU4NDQwMX0.pgTN6cndRWYWSC1XDhvNg6Fb8Y3FqhDEufjlK508SMU';

// Initialize Supabase client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Wait for the DOM to be fully loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // REGISTRATION LOGIC
    // ---------------------------------------------------------
    const registrationForm = document.getElementById('registration-form');
    
    if (registrationForm) {
        registrationForm.addEventListener('submit', async function(e) {
            e.preventDefault(); // Prevent default form submission reload
            
            // 1. Gather Form Data
            const fullName = document.getElementById('full-name').value.trim();
            const email = document.getElementById('email').value.trim();
            const phoneStr = document.getElementById('phone').value.trim();
            const gender = document.getElementById('gender').value;
            const course = document.getElementById('course').value;
            const addressEl = document.getElementById('address');
            const address = addressEl ? addressEl.value.trim() : '';
            
            // 2. Validate Empty Fields (fallback, though HTML 'required' handles most)
            if (!fullName || !email || !phoneStr || !gender || !course) {
                Swal.fire({ icon: 'warning', title: 'Missing Fields', text: 'Please fill in all required fields.' });
                return;
            }

            // 3. Validate Email Format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                Swal.fire({ icon: 'error', title: 'Invalid Email', text: 'Please enter a valid email address.' });
                return;
            }

            // 4. Validate Phone Number (must be numeric and appropriate length)
            const phone = parseInt(phoneStr, 10);
            if (isNaN(phone) || phoneStr.length < 10) {
                Swal.fire({ icon: 'error', title: 'Invalid Phone Number', text: 'Please enter a valid phone number.' });
                return;
            }
            
            const submitBtn = registrationForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'Processing...';
            submitBtn.disabled = true;

            try {
                // 5. Prevent Duplicate Submissions
                // Check if email already exists in the students table
                const { data: existingUser, error: checkError } = await supabaseClient
                    .from('students')
                    .select('email')
                    .eq('email', email)
                    .maybeSingle();

                if (checkError) throw checkError;
                
                if (existingUser) {
                    Swal.fire({ icon: 'error', title: 'Already Registered', text: 'An application with this email already exists.' });
                    submitBtn.innerText = originalBtnText;
                    submitBtn.disabled = false;
                    return;
                }

                // 6. Generate Registration Number Automatically
                // Fetch the total count of students to generate the next ID
                const { count, error: countError } = await supabaseClient
                    .from('students')
                    .select('*', { count: 'exact', head: true });
                
                if (countError) throw countError;

                // Format: CCI-2026-0001
                const nextIdNumber = (count + 1).toString().padStart(4, '0');
                const regNo = `CCI-2026-${nextIdNumber}`;

                // 7. Save Data to Supabase
                const { error: insertError } = await supabaseClient
                    .from('students')
                    .insert([
                        { 
                            fullname: fullName, 
                            email: email, 
                            phone: phone, 
                            gender: gender, 
                            course: course, 
                            address: address || null,
                            reg_no: regNo 
                        }
                    ]);

                if (insertError) throw insertError;

                // 8. Show Success Popup and Registration Number
                document.getElementById('generated-id').innerText = regNo;
                registrationForm.style.display = 'none';
                document.getElementById('reg-success').classList.add('active');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                
                Swal.fire({
                    icon: 'success',
                    title: 'Registration Successful!',
                    html: `Your unique Registration ID is:<br><strong style="font-size: 1.5rem; color: #10B981; margin-top: 10px; display: inline-block;">${regNo}</strong>`,
                    confirmButtonColor: '#10B981'
                });

            } catch (error) {
                console.error('Registration Error:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'System Error',
                    text: error.message || 'An error occurred during registration. Please try again.',
                    confirmButtonColor: '#EF4444'
                });
            } finally {
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }


    // ---------------------------------------------------------
    // CERTIFICATE VERIFICATION LOGIC
    // ---------------------------------------------------------
    const verifyForm = document.getElementById('verify-form');
    
    if (verifyForm) {
        verifyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const certIdInput = document.getElementById('cert-id').value.trim().toUpperCase();
            const resultBox = document.getElementById('verify-result');
            const submitBtn = verifyForm.querySelector('button[type="submit"]');
            
            if (!certIdInput) {
                Swal.fire({ icon: 'warning', title: 'Missing Information', text: 'Please enter a Certificate or Registration ID.' });
                return;
            }

            console.log('[Verify] Searching for ID:', certIdInput);

            // Show loading state
            resultBox.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div style="width: 50px; height: 50px; border: 4px solid var(--border-color); border-top-color: var(--logo-blue); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                    <p style="color: var(--text-muted); font-size: 1.05rem;">Querying Cybernet verification records...</p>
                </div>
            `;
            resultBox.classList.add('active');
            submitBtn.disabled = true;

            try {
                // First check if certificate exists in 'certificates' table using cert_no
                console.log('[Verify] Step 1: Checking certificates table for cert_no:', certIdInput);
                const { data: certData, error: certError } = await supabaseClient
                    .from('certificates')
                    .select('id, student_name, course, cert_no, completion_date, status, created_at')
                    .eq('cert_no', certIdInput)
                    .maybeSingle();

                if (certError) {
                    console.error('[Verify] Certificate table error:', certError);
                    throw certError;
                }

                if (certData) {
                    console.log('[Verify] Certificate found:', certData);
                    // Certificate found - show verification details
                    resultBox.innerHTML = `
                        <div class="verification-card">
                            <div class="verification-badge" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 12px 20px; border-radius: 8px; display: inline-block; font-weight: 600; margin-bottom: 20px;">
                                ✓ Certificate Verified
                            </div>
                            
                            <div class="verification-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0;">
                                <div class="grid-item" style="padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 3px solid var(--logo-blue);">
                                    <span class="grid-label" style="display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Student Name</span>
                                    <span class="grid-val" style="display: block; font-size: 1.15rem; color: var(--cert-navy); font-weight: 600;">${certData.student_name}</span>
                                </div>
                                <div class="grid-item" style="padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 3px solid var(--logo-blue);">
                                    <span class="grid-label" style="display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Course Completed</span>
                                    <span class="grid-val" style="display: block; font-size: 1.15rem; color: var(--cert-navy); font-weight: 600;">${certData.course}</span>
                                </div>
                                <div class="grid-item" style="padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 3px solid var(--logo-blue);">
                                    <span class="grid-label" style="display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Certificate ID</span>
                                    <span class="grid-val" style="display: block; font-size: 1.15rem; color: var(--logo-blue); font-weight: 700; font-family: monospace;">${certData.cert_no}</span>
                                </div>
                                <div class="grid-item" style="padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 3px solid var(--logo-blue);">
                                    <span class="grid-label" style="display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Completion Date</span>
                                    <span class="grid-val" style="display: block; font-size: 1.15rem; color: var(--cert-navy); font-weight: 600;">${certData.completion_date}</span>
                                </div>
                                <div class="grid-item" style="padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 3px solid var(--logo-blue);">
                                    <span class="grid-label" style="display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Status / Grade</span>
                                    <span class="grid-val" style="display: block; font-size: 1.15rem; color: #10B981; font-weight: 700;">${certData.status || 'Valid'}</span>
                                </div>
                                <div class="grid-item" style="padding: 15px; background: #f9fafb; border-radius: 8px; border-left: 3px solid var(--logo-blue);">
                                    <span class="grid-label" style="display: block; font-size: 0.85rem; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">Issued On</span>
                                    <span class="grid-val" style="display: block; font-size: 1.15rem; color: var(--cert-navy); font-weight: 600;">${new Date(certData.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>

                            <div class="verification-actions" style="display: flex; gap: 12px; margin-top: 25px;">
                                <a href="certificate.html?id=${encodeURIComponent(certData.cert_no)}" target="_blank" class="btn btn-primary" style="text-decoration: none; flex: 1; text-align: center;">
                                    👁 View Certificate Preview
                                </a>
                                <a href="certificate.html?id=${encodeURIComponent(certData.cert_no)}&download=true" target="_blank" class="btn btn-outline" style="text-decoration: none; flex: 1; text-align: center; border: 1px solid var(--border-color);">
                                    📥 Download PDF
                                </a>
                            </div>
                        </div>
                    `;
                    submitBtn.disabled = false;
                    return;
                }

                // Second fallback: check if it's a registration number in 'students' table
                console.log('[Verify] Step 2: Certificate not found, checking students table for reg_no:', certIdInput);
                const { data: studentData, error: studentError } = await supabaseClient
                    .from('students')
                    .select('id, fullname, reg_no, course, created_at')
                    .eq('reg_no', certIdInput)
                    .maybeSingle();

                if (studentError) {
                    console.error('[Verify] Student table error:', studentError);
                    throw studentError;
                }

                if (studentData) {
                    console.log('[Verify] Student found, but no certificate issued:', studentData);
                    // Student is registered, but certificate is NOT issued yet
                    resultBox.innerHTML = `
                        <div style="border-left: 4px solid #F59E0B; padding: 25px; background: rgba(245, 158, 11, 0.05); border-radius: 8px; text-align: left;">
                            <h3 style="color: #D97706; margin-top: 0; margin-bottom: 15px; font-size: 1.25rem;">⚠️ Certificate Not Issued Yet</h3>
                            <p style="margin-bottom: 12px; color: var(--text-main); font-size: 1.05rem;">
                                Student <strong style="color: var(--cert-navy);">${studentData.fullname}</strong> is successfully registered.
                            </p>
                            <div style="background: #fff; padding: 12px; border-radius: 6px; border-left: 3px solid #F59E0B; margin: 15px 0;">
                                <p style="margin: 5px 0; color: var(--text-muted); font-size: 0.95rem;">
                                    <strong>Registration ID:</strong> ${studentData.reg_no}
                                </p>
                                <p style="margin: 5px 0; color: var(--text-muted); font-size: 0.95rem;">
                                    <strong>Course:</strong> ${studentData.course}
                                </p>
                                <p style="margin: 5px 0; color: var(--text-muted); font-size: 0.95rem;">
                                    <strong>Registered:</strong> ${new Date(studentData.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <p style="color: #EF4444; font-weight: 600; font-size: 1.05rem; margin: 15px 0; padding-top: 12px; border-top: 1px solid rgba(245, 158, 11, 0.2);">
                                Certificate has not been issued yet.
                            </p>
                            <p style="font-size: 0.95rem; color: var(--text-muted); margin: 10px 0;">
                                Your certificate will be available once you complete all course requirements. Please contact the administrative desk or check back later.
                            </p>
                        </div>
                    `;
                    submitBtn.disabled = false;
                    return;
                }

                // Case C: ID not found anywhere in our systems
                console.log('[Verify] No record found for ID:', certIdInput);
                resultBox.innerHTML = `
                    <div style="border-left: 4px solid #EF4444; padding: 25px; background: rgba(239, 68, 68, 0.05); border-radius: 8px; text-align: left;">
                        <h3 style="color: #DC2626; margin-top: 0; margin-bottom: 15px; font-size: 1.25rem;">✗ Record Not Found</h3>
                        <p style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 12px;">
                            The ID "<strong style="color: var(--cert-navy); font-family: monospace;">${certIdInput}</strong>" was not found in our records.
                        </p>
                        <p style="font-size: 0.95rem; color: var(--text-muted); margin: 10px 0;">
                            Possible reasons:
                        </p>
                        <ul style="color: var(--text-muted); font-size: 0.95rem; margin: 10px 0 15px; padding-left: 20px;">
                            <li>The Registration ID or Certificate ID might be typed incorrectly (including hyphens)</li>
                            <li>The student may not be registered in our system yet</li>
                            <li>The student registration may have been removed</li>
                        </ul>
                        <p style="font-size: 0.95rem; color: var(--text-muted); margin: 15px 0; padding-top: 12px; border-top: 1px solid rgba(239, 68, 68, 0.2);">
                            If you believe this is an error, please contact our administrative support team at <strong>cybernetcafeng@gmail.com</strong> or call <strong>+234 806 571-2820</strong>.
                        </p>
                    </div>
                `;

            } catch (error) {
                console.error('[Verify] Error during verification:', error);
                resultBox.innerHTML = `
                    <div style="border-left: 4px solid #EF4444; padding: 25px; background: rgba(239, 68, 68, 0.05); border-radius: 8px; text-align: left;">
                        <h3 style="color: #DC2626; margin-top: 0; margin-bottom: 15px; font-size: 1.25rem;">❌ System Error</h3>
                        <p style="color: var(--text-main); font-size: 1.05rem; margin-bottom: 12px;">
                            There was an error communicating with the verification database.
                        </p>
                        <p style="font-size: 0.85rem; color: #991b1b; margin: 10px 0; font-family: monospace; background: #fee2e2; padding: 10px; border-radius: 4px; border-left: 3px solid #dc2626;">
                            ${error.message || 'Unknown network error'}
                        </p>
                        <p style="font-size: 0.95rem; color: var(--text-muted); margin-top: 15px;">
                            Please try again in a few moments. If the problem persists, contact support.
                        </p>
                    </div>
                `;
            } finally {
                submitBtn.disabled = false;
            }
        });

        // Dynamic URL Parameter checking for QR-code scanner triggers
        const urlParams = new URLSearchParams(window.location.search);
        const urlCertId = urlParams.get('id');
        if (urlCertId) {
            console.log('[Verify] Auto-search triggered from URL parameter:', urlCertId);
            document.getElementById('cert-id').value = urlCertId;
            // Dispatch a submit event cleanly to start verification
            verifyForm.dispatchEvent(new Event('submit'));
        }
    }

    // ---------------------------------------------------------
    // ADMIN DASHBOARD LOGIC
    // ---------------------------------------------------------
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminLoginSection = document.getElementById('admin-login-section');
    const adminDashboardSection = document.getElementById('admin-dashboard-section');
    const adminNavActions = document.getElementById('admin-nav-actions');
    const adminEmailDisplay = document.getElementById('admin-email-display');
    const logoutBtn = document.getElementById('admin-logout-btn');

    if (adminLoginForm) {
        // 1. Auth State Listener
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session) {
                // User is logged in
                adminLoginSection.style.display = 'none';
                adminDashboardSection.style.display = 'block';
                adminNavActions.style.display = 'flex';
                adminEmailDisplay.innerText = session.user.email;
                fetchStudents();
                fetchCertificates();
            } else {
                // User is logged out
                adminLoginSection.style.display = 'flex';
                adminDashboardSection.style.display = 'none';
                adminNavActions.style.display = 'none';
            }
        });

        // 2. Login Submit
        adminLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const btn = adminLoginForm.querySelector('button');
            btn.innerText = 'Authenticating...';
            btn.disabled = true;

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            
            btn.innerText = 'Secure Login';
            btn.disabled = false;

            if (error) {
                Swal.fire({ icon: 'error', title: 'Login Failed', text: error.message });
            }
        });

        // 3. Logout
        logoutBtn.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
        });

        // 4. Tab Switching Logic
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons and panels
                tabBtns.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.dashboard-panel').forEach(p => {
                    p.classList.remove('active');
                    p.style.display = ''; // Clear inline styles that might block CSS
                });
                
                // Add active class to clicked button and target panel
                btn.classList.add('active');
                const target = document.getElementById(btn.getAttribute('data-target'));
                if (target) {
                    target.classList.add('active');
                }
            });
        });

        // 5. Data Fetching
        document.getElementById('refresh-students-btn').addEventListener('click', fetchStudents);
        document.getElementById('refresh-certificates-btn').addEventListener('click', fetchCertificates);

        async function fetchStudents() {
            const tbody = document.getElementById('students-table-body');
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading students...</td></tr>';
            
            const { data, error } = await supabaseClient.from('students').select('*').order('created_at', { ascending: false });
            
            if (error) {
                tbody.innerHTML = `<tr><td colspan="5" style="color: red;">Error: ${error.message}</td></tr>`;
                return;
            }
            
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No students found.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(s => `
                <tr>
                    <td style="font-weight: 600;">${s.reg_no}</td>
                    <td>
                        <button type="button"
                                class="btn btn-outline btn-sm"
                                style="padding: 6px 12px;"
                                onclick="window.showStudentDetails('${s.reg_no}')">
                            ${s.fullname}
                        </button>
                        <br><small style="color: var(--text-muted);">${s.email}</small>
                    </td>
                    <td>${s.course}</td>
                    <td>${new Date(s.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-outline btn-sm" onclick="window.issueCertificate('${s.fullname.replace(/'/g, "\\'")}', '${s.course.replace(/'/g, "\\'")}', '${s.reg_no}')">
                            Issue Certificate
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        window.showStudentDetails = async function(regNo) {
            if (!regNo) return;

            Swal.fire({
                title: 'Loading student details...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            try {
                const { data: studentData, error: studentError } = await supabaseClient
                    .from('students')
                    .select('fullname, phone, email, address, course, reg_no, created_at')
                    .eq('reg_no', regNo)
                    .maybeSingle();

                if (studentError) throw studentError;
                if (!studentData) {
                    Swal.fire({ icon: 'error', title: 'Student not found', text: `No student found for Reg ID: ${regNo}` });
                    return;
                }

                // Check if certificate is issued for this student
                const { data: certData } = await supabaseClient
                    .from('certificates')
                    .select('cert_no, status, completion_date')
                    .eq('cert_no', regNo)
                    .maybeSingle();

                const certIssued = !!certData;
                const certStatus = certIssued ? (certData.status || 'Valid') : 'Not Issued Yet';

                const enrolledDate = studentData.created_at ? new Date(studentData.created_at).toLocaleDateString() : 'N/A';
                const addressText = studentData.address || 'N/A';
                const phoneText = studentData.phone || 'N/A';

                Swal.fire({
                    icon: certIssued ? 'success' : 'warning',
                    title: 'Student Details',
                    html: `
                        <div style="text-align:left;">
                            <div style="display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:12px;">
                                <div>
                                    <div style="color: var(--text-muted); font-weight:700; text-transform:uppercase; font-size:0.85rem;">Name</div>
                                    <div style="font-size:1.25rem; font-weight:800; color: var(--primary-navy);">${studentData.fullname}</div>
                                </div>
                                <div>
                                    <div style="color: var(--text-muted); font-weight:700; text-transform:uppercase; font-size:0.85rem;">Course</div>
                                    <div style="font-size:1.1rem; font-weight:700; color: var(--logo-blue);">${studentData.course}</div>
                                </div>
                            </div>

                            <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:10px; padding:14px 16px;">
                                <div style="margin:6px 0; font-size:0.95rem;"><strong>Reg No:</strong> <span style="font-family:monospace; color: var(--primary-navy); font-weight:700;">${studentData.reg_no}</span></div>
                                <div style="margin:6px 0; font-size:0.95rem;"><strong>Enrolled Date:</strong> ${enrolledDate}</div>
                                <div style="margin:6px 0; font-size:0.95rem;"><strong>Phone:</strong> ${phoneText}</div>
                                <div style="margin:6px 0; font-size:0.95rem;"><strong>Email:</strong> ${studentData.email || 'N/A'}</div>
                                <div style="margin:6px 0; font-size:0.95rem;"><strong>Address:</strong> ${addressText}</div>

                                <div style="margin:10px 0 0; padding-top:10px; border-top:1px dashed rgba(0,0,0,0.1);">
                                    <div style="color: var(--text-muted); font-weight:700; text-transform:uppercase; font-size:0.85rem; margin-bottom:6px;">Certificate Status</div>
                                    <div style="font-size:1.05rem; font-weight:800; color:${certIssued ? '#10B981' : '#F59E0B'};">${certStatus}</div>
                                </div>
                            </div>
                        </div>
                    `
                });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'System Error', text: error.message || 'Failed to load student details.' });
            }
        };

        async function fetchCertificates() {
            const tbody = document.getElementById('certificates-table-body');
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading certificates...</td></tr>';
            
            const { data, error } = await supabaseClient.from('certificates').select('*').order('created_at', { ascending: false });
            
            if (error) {
                tbody.innerHTML = `<tr><td colspan="5" style="color: red;">Error: ${error.message}</td></tr>`;
                return;
            }

            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No certificates issued yet.</td></tr>';
                return;
            }

            tbody.innerHTML = data.map(c => `
                <tr>
                    <td style="font-weight: 600; color: var(--logo-blue);">${c.cert_no}</td>
                    <td>${c.student_name}</td>
                    <td>${c.course}</td>
                    <td><span class="status-badge status-valid">${c.status}</span></td>
                    <td>${c.completion_date}</td>
                </tr>
            `).join('');
        }

        // 6. Issue Certificate Logic
        window.issueCertificate = async function(studentName, course, regNo) {
            const { value: formValues } = await Swal.fire({
                title: 'Issue New Certificate',
                html: `
                    <div style="text-align: left; margin-top: 10px;">
                        <label style="font-size: 0.9em; font-weight: bold;">Student Name</label>
                        <input id="swal-name" class="swal2-input" value="${studentName}" readonly style="background: #f0f0f0;">
                        <label style="font-size: 0.9em; font-weight: bold; margin-top: 15px; display: block;">Registration / Cert ID</label>
                        <input id="swal-reg" class="swal2-input" value="${regNo}" readonly style="background: #f0f0f0; color: var(--logo-blue); font-weight: bold;">
                        <label style="font-size: 0.9em; font-weight: bold; margin-top: 15px; display: block;">Course Completed</label>
                        <input id="swal-course" class="swal2-input" value="${course}" readonly style="background: #f0f0f0;">
                        <label style="font-size: 0.9em; font-weight: bold; margin-top: 15px; display: block;">Status / Grade</label>
                        <select id="swal-status" class="swal2-input" style="display: flex;">
                            <option value="Valid / Authentic">Valid / Authentic</option>
                            <option value="Distinction">Distinction</option>
                            <option value="Merit">Merit</option>
                            <option value="Pass">Pass</option>
                        </select>
                    </div>
                `,
                focusConfirm: false,
                showCancelButton: true,
                confirmButtonText: 'Generate & Issue',
                preConfirm: () => {
                    return document.getElementById('swal-status').value;
                }
            });

            if (formValues) {
                const status = formValues;
                const today = new Date().toISOString().split('T')[0];
                const certNo = regNo; // Use the exact same Registration Number as the Certificate Number

                Swal.fire({ title: 'Issuing...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });

                const { error } = await supabaseClient.from('certificates').insert([{
                    student_name: studentName,
                    course: course,
                    cert_no: certNo,
                    completion_date: today,
                    status: status
                }]);

                if (error) {
                    Swal.fire('Error', error.message, 'error');
                } else {
                    Swal.fire({
                        icon: 'success',
                        title: 'Certificate Issued!',
                        html: `Certificate ID: <strong>${certNo}</strong> has been saved.`
                    });
                    fetchCertificates(); // Refresh the certificates table
                }
            }
        };
    }
});
