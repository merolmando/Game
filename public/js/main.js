document.addEventListener('DOMContentLoaded', () => {
  const navLinks = document.querySelectorAll('.nav-links a');
  const currentPath = window.location.pathname;

  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === currentPath);
  });
});
