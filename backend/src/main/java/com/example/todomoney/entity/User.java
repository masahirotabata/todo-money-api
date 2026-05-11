package com.example.todomoney.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.OffsetDateTime;

@Entity
@Table(
    name = "users",
    uniqueConstraints = @UniqueConstraint(columnNames = "email")
)
public class User {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  // ★ 匿名ユーザー用に null を許容しておく（DB では UNIQUE だけ維持）
  @Column
  private String email;

  @Column(name = "password_hash")
  private String passwordHash;

  // ★ 追加: 端末識別用の deviceId（匿名ログインはこちらで管理）
  @Column(name = "device_id", unique = true)
  private String deviceId;

  @Column(name = "created_at")
  private OffsetDateTime createdAt = OffsetDateTime.now();

  // ===== getter =====
  public Long getId() {
    return id;
  }

  public String getEmail() {
    return email;
  }

  public String getPasswordHash() {
    return passwordHash;
  }

  public String getDeviceId() {
    return deviceId;
  }

  public OffsetDateTime getCreatedAt() {
    return createdAt;
  }

  // ===== setter =====
  public void setEmail(String email) {
    this.email = email;
  }

  public void setPasswordHash(String passwordHash) {
    this.passwordHash = passwordHash;
  }

  public void setDeviceId(String deviceId) {
    this.deviceId = deviceId;
  }
}
