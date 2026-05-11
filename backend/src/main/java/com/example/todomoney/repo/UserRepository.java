package com.example.todomoney.repo;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.todomoney.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

  // 既存：メールアドレスで検索
  Optional<User> findByEmail(String email);

  // 追加：deviceId で検索（匿名ログイン用）
  Optional<User> findByDeviceId(String deviceId);
}
