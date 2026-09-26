import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Home } from './pages/Home'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'
import { OrdersPage } from './pages/OrdersPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { CreateOrderPage } from './pages/CreateOrderPage'
import { InventoryPage } from './pages/InventoryPage'
import { InventoryDetailPage } from './pages/InventoryDetailPage'
import { InventoryFormPage } from './pages/InventoryFormPage'
import { MedicationRequestsPage } from './pages/MedicationRequestsPage'
import { CreateMedicationRequestPage } from './pages/CreateMedicationRequestPage'
import { MedicationRequestDetailPage } from './pages/MedicationRequestDetailPage'
import { PharmaciesPage } from './pages/PharmaciesPage'
import { PharmacyDetailPage } from './pages/PharmacyDetailPage'
import { PharmacyFormPage } from './pages/PharmacyFormPage'
import { ReportsPage } from './pages/ReportsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/pharmacies"
          element={<PharmaciesPage />}
        />
        <Route
          path="/pharmacies/:id"
          element={<PharmacyDetailPage />}
        />
        <Route
          path="/pharmacies/new"
          element={
            <ProtectedRoute>
              <PharmacyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pharmacies/:id/edit"
          element={
            <ProtectedRoute>
              <PharmacyFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests"
          element={
            <ProtectedRoute>
              <MedicationRequestsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/new"
          element={
            <ProtectedRoute>
              <CreateMedicationRequestPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/requests/:id"
          element={
            <ProtectedRoute>
              <MedicationRequestDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/new"
          element={
            <ProtectedRoute>
              <CreateOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedRoute>
              <InventoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/new"
          element={
            <ProtectedRoute>
              <InventoryFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/:id"
          element={
            <ProtectedRoute>
              <InventoryDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/:id/edit"
          element={
            <ProtectedRoute>
              <InventoryFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  )
}
