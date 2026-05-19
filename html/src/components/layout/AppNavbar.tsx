import React from 'react';
import { Container, Navbar, Nav, Button } from 'react-bootstrap';

interface AppNavbarProps {
  onOpenSettings: () => void;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({ onOpenSettings }) => (
  <Navbar className="navbar-dark sticky-top" expand="lg">
    <Container fluid>
      <Navbar.Brand href="#">
        <i className="bi bi-broadcast me-2"></i>
        RISTMonitor
      </Navbar.Brand>
      <Nav className="ms-auto">
        <Button variant="link" className="nav-link" onClick={onOpenSettings} title="Settings">
          <i className="bi bi-gear"></i>
        </Button>
      </Nav>
    </Container>
  </Navbar>
);
