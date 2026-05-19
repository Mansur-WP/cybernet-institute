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

            // Show loading state
            resultBox.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="width: 40px; height: 40px; border: 4px solid var(--border-color); border-top-color: var(--logo-blue); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                    <p style="color: var(--text-muted);">Querying Cybernet verification records...</p>
                </div>
            `;
            resultBox.classList.add('active');
            submitBtn.disabled = true;

            try {
                // 1. First, search if the student exists in the 'students' table
                const { data: studentData, error: studentError } = await supabaseClient
                    .from('students')
                    .select('fullname, reg_no, course, created_at')
                    .eq('reg_no', certIdInput)
                    .maybeSingle();

                if (studentError) throw studentError;

                // 2. Next, check if the certificate has been officially issued in the 'certificates' table
                const lookupId = studentData ? studentData.reg_no : certIdInput;
                const { data: certData, error: certError } = await supabaseClient
                    .from('certificates')
                    .select('*')
                    .eq('cert_no', lookupId)
                    .maybeSingle();

                if (certError) throw certError;

                // Case A: Student is registered, but certificate is NOT issued yet
                if (studentData && !certData) {
                    resultBox.innerHTML = `
                        <div style="border-left: 4px solid #F59E0B; padding: 25px; background: rgba(245, 158, 11, 0.05); border-radius: 4px; text-align: left;">
                            <h3 style="color: #D97706; margin-bottom: 10px; font-size: 1.25rem;">⚠ Certificate Not Issued</h3>
                            <p style="margin-bottom: 8px; color: var(--text-main);">
                                Student <strong>${studentData.fullname}</strong> is successfully registered under Registration ID <strong>${studentData.reg_no}</strong> for <strong>${studentData.course}</strong>.
                            </p>
                            <p style="color: #EF4444; font-weight: 600; font-size: 1.05rem; margin-top: 15px; border-top: 1px solid rgba(245, 158, 11, 0.2); padding-top: 12px;">
                                "Certificate has not been issued yet."
                            </p>
                            <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 8px;">
                                Please complete course requirements or contact the administrative desk to request certificate release.
                            </p>
                        </div>
                    `;
                    return;
                }

                // Case B: Certificate is successfully verified
                if (certData) {
                    resultBox.innerHTML = `
                        <div class="verification-card">
                            <div class="verification-badge">✓ Verified Student Certificate</div>
                            
                            <div class="verification-grid">
                                <div class="grid-item">
                                    <span class="grid-label">Student Name</span>
                                    <span class="grid-val">${certData.student_name}</span>
                                </div>
                                <div class="grid-item">
                                    <span class="grid-label">Course Completed</span>
                                    <span class="grid-val">${certData.course}</span>
                                </div>
                                <div class="grid-item">
                                    <span class="grid-label">Certificate / Reg ID</span>
                                    <span class="grid-val" style="color: var(--logo-blue);">${certData.cert_no}</span>
                                </div>
                                <div class="grid-item">
                                    <span class="grid-label">Completion Date</span>
                                    <span class="grid-val">${certData.completion_date}</span>
                                </div>
                                <div class="grid-item">
                                    <span class="grid-label">Grade / Status</span>
                                    <span class="grid-val grade-${certData.status.toLowerCase().replace(/\s+/g, '-')}">${certData.status || 'Valid'}</span>
                                </div>
                            </div>

                            <div class="verification-actions">
                                <a href="certificate.html?id=${certData.cert_no}" target="_blank" class="btn btn-primary">
                                    👁 View Preview
                                </a>
                                <a href="certificate.html?id=${certData.cert_no}&download=true" target="_blank" class="btn btn-outline" style="border: 1px solid var(--border-color);">
                                    📥 Download PDF
                                </a>
                            </div>
                        </div>
                    `;
                    return;
                }

                // Case C: ID not found anywhere in our systems
                resultBox.innerHTML = `
                    <div style="border-left: 4px solid #EF4444; padding: 25px; background: rgba(239, 68, 68, 0.05); border-radius: 4px; text-align: left;">
                        <h3 style="color: #DC2626; margin-bottom: 10px; font-size: 1.25rem;">✗ Verification Failed</h3>
                        <p style="color: var(--text-main);">The Certificate ID "<strong>${certIdInput}</strong>" could not be verified.</p>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 10px;">
                            Ensure the ID is typed correctly (including prefixes like CCI-2026-). If you believe this is an error, please reach out to academic support.
                        </p>
                    </div>
                `;

            } catch (error) {
                console.error('Verification Error:', error);
                resultBox.innerHTML = `
                    <div style="border-left: 4px solid #EF4444; padding: 25px; background: rgba(239, 68, 68, 0.05); border-radius: 4px; text-align: left;">
                        <h3 style="color: #DC2626; margin-bottom: 10px;">✗ System Error</h3>
                        <p style="color: var(--text-main);">There was an error communicating with the verification database.</p>
                        <p style="font-size: 0.85em; color: #991b1b; margin-top: 10px;">Details: ${error.message || 'Unknown network error'}</p>
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
                    <td>${s.fullname}<br><small style="color: var(--text-muted);">${s.email}</small></td>
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
