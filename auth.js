export async function login(email, password){
  try {
    if(!email || !password){
      alert("Enter email and password.");
      return;
    }
    if(password.length < 6){
      alert("Password must be at least 6 characters.");
      return;
    }
    await signInWithEmailAndPassword(auth, email, password);
  } catch(e){
    console.error("Login error:", e.code, e.message);
    // Treat invalid-credential as “maybe user doesn’t exist yet”
    if(e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential'){
      try {
        await createUserWithEmailAndPassword(auth, email, password);
      } catch(e2){
        console.error("Signup error:", e2.code, e2.message);
        alert(e2.code + ": " + e2.message);
      }
    } else {
      alert(e.code + ": " + e.message);
    }
  }
}
